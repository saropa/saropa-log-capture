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
const session_metadata_1 = require("../../../modules/session/session-metadata");
suite('SessionMetadataStore', () => {
    test('getMetaUri returns undefined when no workspace folder is available', () => {
        const store = new session_metadata_1.SessionMetadataStore();
        const fakeUri = { toString: () => 'file:///workspace/reports/test.log' };
        const metaUri = store.getMetaUri(fakeUri);
        // Outside a real workspace, getCentralMetaUri returns undefined (no sidecar fallback)
        assert.strictEqual(metaUri, undefined);
    });
    test('Annotation interface should hold expected fields', () => {
        const ann = {
            lineIndex: 5,
            text: 'This is a note',
            timestamp: '2026-01-27T12:00:00.000Z',
        };
        assert.strictEqual(ann.lineIndex, 5);
        assert.strictEqual(ann.text, 'This is a note');
        assert.ok(ann.timestamp.length > 0);
    });
    test('SessionMeta interface should support optional fields', () => {
        const meta = {};
        assert.strictEqual(meta.displayName, undefined);
        assert.strictEqual(meta.tags, undefined);
        assert.strictEqual(meta.annotations, undefined);
    });
    test('isOurSidecar should match files with severity count fields', () => {
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ errorCount: 0, warningCount: 0, perfCount: 0, fwCount: 0, infoCount: 10 }), true);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ errorCount: 5 }), true);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ infoCount: 100 }), true);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ fwCount: 0 }), true);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ warningCount: 3 }), true);
    });
    test('isOurSidecar should reject non-matching content', () => {
        assert.strictEqual((0, session_metadata_1.isOurSidecar)(null), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)('string'), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)(42), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)([]), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({}), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ name: 'some other tool' }), false);
        assert.strictEqual((0, session_metadata_1.isOurSidecar)({ errorCount: 'not a number' }), false);
    });
    test('SessionMeta should hold all fields when populated', () => {
        const meta = {
            displayName: 'My Session',
            tags: ['bug', 'prod'],
            annotations: [
                { lineIndex: 0, text: 'First line note', timestamp: '2026-01-27T12:00:00.000Z' },
            ],
        };
        assert.strictEqual(meta.displayName, 'My Session');
        assert.strictEqual(meta.tags?.length, 2);
        assert.strictEqual(meta.annotations?.length, 1);
        assert.strictEqual(meta.annotations?.[0].lineIndex, 0);
    });
    test('hasMeaningfulPerformanceData should reject placeholder snapshots (false positive guard)', () => {
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)(undefined), false);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)(null), false);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({}), false);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ snapshot: {} }), false);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ snapshot: { note: 'placeholder' } }), false);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ samplesFile: '   ' }), false);
    });
    test('hasMeaningfulPerformanceData should accept real snapshot/sample metadata', () => {
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ samplesFile: 'session.perf.json' }), true);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ snapshot: { cpus: 8 } }), true);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ snapshot: { totalMemMb: 16384, freeMemMb: 8000 } }), true);
        assert.strictEqual((0, session_metadata_1.hasMeaningfulPerformanceData)({ snapshot: { processMemMb: 512 } }), true);
    });
});
//# sourceMappingURL=session-metadata.test.js.map