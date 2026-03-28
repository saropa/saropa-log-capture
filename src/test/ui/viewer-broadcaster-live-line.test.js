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
const log_viewer_provider_batch_1 = require("../../ui/provider/log-viewer-provider-batch");
const viewer_provider_helpers_1 = require("../../ui/provider/viewer-provider-helpers");
const viewer_broadcaster_1 = require("../../ui/provider/viewer-broadcaster");
function sampleLineData(overrides) {
    return {
        text: overrides.text,
        isMarker: overrides.isMarker ?? false,
        lineCount: overrides.lineCount ?? 1,
        category: overrides.category ?? 'stdout',
        timestamp: overrides.timestamp ?? new Date(0),
        ...overrides,
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
//# sourceMappingURL=viewer-broadcaster-live-line.test.js.map