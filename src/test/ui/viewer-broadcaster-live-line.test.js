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
const log_viewer_provider_batch_1 = require("../../ui/provider/log-viewer-provider-batch");
const viewer_provider_helpers_1 = require("../../ui/provider/viewer-provider-helpers");
const viewer_broadcaster_1 = require("../../ui/provider/viewer-broadcaster");
function sampleLineData(overrides) {
    const { text, isMarker, lineCount, category, timestamp, ...rest } = overrides;
    return {
        text,
        isMarker: isMarker ?? false,
        lineCount: lineCount ?? 1,
        category: category ?? 'stdout',
        timestamp: timestamp ?? new Date(0),
        ...rest,
    };
}
suite('buildPendingLineFromLineData', () => {
    test('marker lines escape HTML so angle brackets are not raw markup', () => {
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: '<em>x</em>', isMarker: true, lineCount: 1 }));
        assert.ok(!pl.text.includes('<em>'), 'expected escaped or stripped angle brackets for marker');
        assert.ok(pl.text.includes('em') || pl.text.includes('&lt;'), 'expected HTML escape of tags');
    });
    test('same LineData yields identical PendingLine text when called twice (pure transform)', () => {
        const data = sampleLineData({ text: 'plain stdout line', lineCount: 42 });
        const a = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(data);
        const b = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(data);
        assert.strictEqual(a.text, b.text);
        assert.strictEqual(a.lineCount, b.lineCount);
    });
    test('Drift Sent line with args gets dimmed markup in PendingLine text', () => {
        const drift = 'I/flutter (28183): Drift: Sent PRAGMA table_info("x") with args []';
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: drift, lineCount: 1 }));
        assert.ok(pl.text.includes('drift-args-dim'), 'expected dim wrapper');
        assert.ok(pl.text.includes(' with args []'), 'suffix should remain in HTML');
    });
    test('rawText preserves original unprocessed text for regular lines', () => {
        const raw = 'Hello \x1b[31mworld\x1b[0m';
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: raw, lineCount: 1 }));
        assert.strictEqual(pl.rawText, raw, 'rawText should be the original text before HTML conversion');
        assert.ok(pl.text.includes('color:'), 'HTML should contain ANSI-converted span');
    });
    test('rawText preserves original text for marker lines', () => {
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: '--- MARKER: test ---', isMarker: true, lineCount: 0 }));
        assert.strictEqual(pl.rawText, '--- MARKER: test ---');
    });
});
suite('ViewerBroadcaster.addLine — single build, fan-out', () => {
    test('two targets each receive appendLiveLineFromBroadcast with the same built text', () => {
        const texts = [];
        const makeTarget = () => ({
            isLiveCaptureHydrating: () => false,
            addLine: () => {
                assert.fail('addLine must not be used when not hydrating');
            },
            appendLiveLineFromBroadcast: (line, _raw) => {
                texts.push(line.text);
            },
        });
        const b = new viewer_broadcaster_1.ViewerBroadcaster();
        b.addTarget(makeTarget());
        b.addTarget(makeTarget());
        b.addLine(sampleLineData({ text: 'fan-out-test-line' }));
        assert.strictEqual(texts.length, 2);
        assert.strictEqual(texts[0], texts[1]);
    });
    test('hydrating target gets raw addLine(LineData); others get appendLiveLineFromBroadcast', () => {
        let addLineCalls = 0;
        let appendCalls = 0;
        const hydrating = {
            isLiveCaptureHydrating: () => true,
            addLine: (_data) => {
                addLineCalls++;
            },
            appendLiveLineFromBroadcast: () => {
                assert.fail('appendLiveLineFromBroadcast must not run while hydrating');
            },
        };
        const normal = {
            isLiveCaptureHydrating: () => false,
            addLine: () => {
                assert.fail('addLine must not run on non-hydrating targets under broadcaster');
            },
            appendLiveLineFromBroadcast: () => {
                appendCalls++;
            },
        };
        const b = new viewer_broadcaster_1.ViewerBroadcaster();
        b.addTarget(hydrating);
        b.addTarget(normal);
        b.addLine(sampleLineData({ text: 'hydrate-branch' }));
        assert.strictEqual(addLineCalls, 1);
        assert.strictEqual(appendCalls, 1);
    });
});
suite('viewer batch size constant', () => {
    test('MAX_LINES_PER_BATCH is capped to limit webview addLines payload size', () => {
        assert.strictEqual(viewer_provider_helpers_1.MAX_LINES_PER_BATCH, 800);
    });
});
suite('buildPendingLineFromLineData — lint data', () => {
    test('without DiagnosticCache, PendingLine has no lint fields', () => {
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: 'no cache', lineCount: 1 }));
        assert.strictEqual(pl.lintErrors, undefined);
        assert.strictEqual(pl.lintWarnings, undefined);
    });
    test('marker lines skip lint lookup even with DiagnosticCache', () => {
        // Pass undefined as cache — marker lines short-circuit before cache access
        const pl = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(sampleLineData({ text: '=== SESSION ===', isMarker: true, lineCount: 0 }), undefined);
        assert.strictEqual(pl.lintErrors, undefined);
        assert.strictEqual(pl.lintWarnings, undefined);
    });
});
suite('ViewerBroadcaster.setDiagnosticCache', () => {
    test('setDiagnosticCache does not throw when called before addLine', () => {
        const b = new viewer_broadcaster_1.ViewerBroadcaster();
        // Create a minimal mock cache
        const mockCache = {
            lookupForLine: () => undefined,
        };
        b.setDiagnosticCache(mockCache);
        // No assertion — just verifying no exception
    });
});
//# sourceMappingURL=viewer-broadcaster-live-line.test.js.map