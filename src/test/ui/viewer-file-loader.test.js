"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const viewer_file_loader_1 = require("../../ui/viewer/viewer-file-loader");
suite('Viewer file loader', () => {
    const ctx = {
        classifyFrame: () => undefined,
        sessionMidnightMs: 0,
    };
    suite('parseRawLinesToPending', () => {
        test('returns one PendingLine per input line', () => {
            const lines = ['[stdout] hello', '[stderr] world'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending.length, 2);
        });
        test('parses marker lines with isMarker true', () => {
            const lines = ['--- MARKER: test ---'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].isMarker, true);
        });
        test('parses category-prefixed lines with category', () => {
            const lines = ['[stdout] some output'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].category, 'stdout');
            assert.strictEqual(pending[0].isMarker, false);
        });
        test('parses [+Nms] elapsed and sets elapsedMs for replay timing', () => {
            const lines = ['[+125ms] [stdout] first', '[+500ms] [stderr] second'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].elapsedMs, 125);
            assert.strictEqual(pending[0].category, 'stdout');
            assert.strictEqual(pending[1].elapsedMs, 500);
            assert.strictEqual(pending[1].category, 'stderr');
        });
        test('parses [+N.Ns] and [+Ns] elapsed', () => {
            const lines = ['[+1.5s] [console] slow', '[+15s] [stdout] gap'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].elapsedMs, 1500);
            assert.strictEqual(pending[1].elapsedMs, 15000);
        });
        test('rawText preserves original line text before HTML conversion', () => {
            const lines = ['[stdout] hello <world>'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending[0].rawText, 'hello <world>');
        });
        test('rawText on marker preserves marker text', () => {
            const lines = ['--- MARKER: test ---'];
            const pending = (0, viewer_file_loader_1.parseRawLinesToPending)(lines, ctx);
            assert.strictEqual(pending[0].rawText, 'MARKER: test');
        });
    });
    suite('parseElapsedToMs', () => {
        test('parses +Nms to ms', () => {
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('+125ms'), 125);
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('+0ms'), 0);
        });
        test('parses +N.Ns and +Ns to ms', () => {
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('+1.5s'), 1500);
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('+15s'), 15000);
        });
        test('returns undefined for invalid input', () => {
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)(''), undefined);
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('125ms'), undefined);
            assert.strictEqual((0, viewer_file_loader_1.parseElapsedToMs)('+1.5m'), undefined);
        });
    });
    suite('externalSidecarLabelFromFileName', () => {
        test('extracts label between main base and .log', () => {
            assert.strictEqual((0, viewer_file_loader_1.externalSidecarLabelFromFileName)('session', 'session.app.log'), 'app');
        });
        test('returns external when pattern does not match', () => {
            assert.strictEqual((0, viewer_file_loader_1.externalSidecarLabelFromFileName)('session', 'other.app.log'), 'external');
        });
    });
    suite('parseExternalSidecarToPending', () => {
        test('assigns source external:label per line', () => {
            const pending = (0, viewer_file_loader_1.parseExternalSidecarToPending)('line one\nline two', 'app');
            assert.strictEqual(pending.length, 2);
            assert.strictEqual(pending[0].source, 'external:app');
            assert.strictEqual(pending[1].source, 'external:app');
        });
        test('rawText preserves original sidecar line', () => {
            const pending = (0, viewer_file_loader_1.parseExternalSidecarToPending)('raw <b>text</b>', 'app');
            assert.strictEqual(pending[0].rawText, 'raw <b>text</b>');
        });
        test('should extract ISO 8601 timestamps from sidecar lines', () => {
            const line = '2026-04-13T11:46:50.066Z  [CACHE]  HIT  flutter.releases';
            const pending = (0, viewer_file_loader_1.parseExternalSidecarToPending)(line, 'sda');
            assert.strictEqual(pending.length, 1);
            const expected = new Date('2026-04-13T11:46:50.066Z').getTime();
            assert.strictEqual(pending[0].timestamp, expected);
        });
        test('should return timestamp 0 for lines without timestamps', () => {
            const pending = (0, viewer_file_loader_1.parseExternalSidecarToPending)('plain log line', 'sda');
            assert.strictEqual(pending[0].timestamp, 0);
        });
        test('should extract timestamps from multiple SDA lines', () => {
            const content = [
                '2026-04-13T11:46:50.066Z  [CACHE]  HIT  flutter.releases',
                '2026-04-13T11:46:50.067Z  [INFO ]  Scan started',
            ].join('\n');
            const pending = (0, viewer_file_loader_1.parseExternalSidecarToPending)(content, 'sda');
            assert.strictEqual(pending.length, 2);
            assert.ok(pending[0].timestamp > 0);
            assert.ok(pending[1].timestamp > 0);
            assert.ok(pending[1].timestamp >= pending[0].timestamp);
        });
    });
    suite('parseUnifiedJsonlToPending', () => {
        test('parses JSONL lines and preserves source order', () => {
            const content = '{"source":"debug","text":"a"}\n{"source":"terminal","text":"b"}\n';
            const { lines, sources } = (0, viewer_file_loader_1.parseUnifiedJsonlToPending)(content, ctx);
            assert.strictEqual(lines.length, 2);
            assert.strictEqual(lines[0].source, 'debug');
            assert.strictEqual(lines[1].source, 'terminal');
            assert.deepStrictEqual(sources, ['debug', 'terminal']);
        });
        test('skips invalid lines', () => {
            const content = 'not json\n{"source":"debug","text":"ok"}\n';
            const { lines, sources } = (0, viewer_file_loader_1.parseUnifiedJsonlToPending)(content, ctx);
            assert.strictEqual(lines.length, 1);
            assert.strictEqual(sources[0], 'debug');
        });
    });
    suite('findHeaderEnd', () => {
        test('returns 0 when no header', () => {
            assert.strictEqual((0, viewer_file_loader_1.findHeaderEnd)(['line1', 'line2']), 0);
        });
        test('returns index after closing equals line', () => {
            const lines = ['=== SAROPA LOG CAPTURE ===', 'Date: 2026-01-01', '==========', '', 'first log'];
            assert.strictEqual((0, viewer_file_loader_1.findHeaderEnd)(lines), 4);
        });
    });
});
//# sourceMappingURL=viewer-file-loader.test.js.map