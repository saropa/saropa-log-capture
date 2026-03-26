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
const assert = __importStar(require("assert"));
const session_severity_counts_1 = require("../../../ui/session/session-severity-counts");
suite('session-severity-counts', () => {
    suite('extractBody', () => {
        test('should extract body after header separator', () => {
            const text = '=== SAROPA LOG CAPTURE ===\nDate: 2025-01-01\n==================\n\n[10:00:00] [stdout] hello';
            const body = (0, session_severity_counts_1.extractBody)(text);
            assert.ok(body.includes('hello'));
            assert.ok(!body.includes('SAROPA LOG CAPTURE'));
        });
        test('should return full text when no header', () => {
            const text = 'just some log lines\nerror here';
            assert.strictEqual((0, session_severity_counts_1.extractBody)(text), text);
        });
    });
    suite('countSeverities', () => {
        test('should count error lines', () => {
            const body = 'normal line\nError: something broke\nfatal crash happened\nanother line';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.errors, 2);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.infos, 2);
        });
        test('should count warning lines', () => {
            const body = 'Warning: low disk space\ncaution: overheating\nnormal line';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.warnings, 2);
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.infos, 1);
        });
        test('should count performance lines', () => {
            const body = 'Skipped 45 frames! Application doing too much work\njank detected\nnormal';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.perfs, 2);
            assert.strictEqual(counts.infos, 1);
        });
        test('should handle logcat error prefixes', () => {
            const body = 'E/MediaCodec: Service not found\nW/System: Clock skew\nI/flutter: ok';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.frameworks, 0);
            assert.strictEqual(counts.infos, 1);
        });
        test('should skip marker and separator lines', () => {
            const body = '---MARKER: test---\n=== SESSION END\nerror in normal line';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.errors, 1);
        });
        test('should return zeros for empty body', () => {
            const counts = (0, session_severity_counts_1.countSeverities)('');
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.warnings, 0);
            assert.strictEqual(counts.perfs, 0);
            assert.strictEqual(counts.frameworks, 0);
            assert.strictEqual(counts.infos, 0);
        });
        test('should not false-positive on error handling terms', () => {
            const body = 'error handler registered\nerror recovery complete\nerror logging enabled';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.errors, 0);
            assert.strictEqual(counts.infos, 3);
        });
        test('should strip timestamp prefix before matching', () => {
            const body = '[10:30:00.123] [stderr] connection failed';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.errors, 1);
        });
        test('should count framework logcat lines (non-flutter tags)', () => {
            const body = 'D/AudioManager: stream changed\nI/ActivityManager: process started\nV/RenderThread: frame ready';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.frameworks, 3);
            assert.strictEqual(counts.infos, 0);
            assert.strictEqual(counts.errors, 0);
        });
        test('should count flutter logcat lines as info, not framework', () => {
            const body = 'I/flutter: user tapped button\nD/flutter: rebuilding widget';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.infos, 2);
            assert.strictEqual(counts.frameworks, 0);
        });
        test('should count launch boilerplate as framework', () => {
            const body = 'Connecting to VM Service at ws://127.0.0.1:5678\nLaunching lib/main.dart in debug mode';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            assert.strictEqual(counts.frameworks, 2);
            assert.strictEqual(counts.infos, 0);
        });
        test('should classify all lines exhaustively', () => {
            const body = 'Error: crash\nWarning: low mem\nSkipped 30 frames!\nD/Zygote: init\nI/flutter: hello\nnormal output';
            const counts = (0, session_severity_counts_1.countSeverities)(body);
            const total = counts.errors + counts.warnings + counts.perfs + counts.frameworks + counts.infos;
            assert.strictEqual(total, 6);
            assert.strictEqual(counts.errors, 1);
            assert.strictEqual(counts.warnings, 1);
            assert.strictEqual(counts.perfs, 1);
            assert.strictEqual(counts.frameworks, 1);
            assert.strictEqual(counts.infos, 2);
        });
    });
});
//# sourceMappingURL=session-severity-counts.test.js.map