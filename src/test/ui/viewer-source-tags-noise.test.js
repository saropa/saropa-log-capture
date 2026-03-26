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
const viewer_source_tags_1 = require("../../ui/viewer-stack-tags/viewer-source-tags");
const viewer_source_tags_ui_1 = require("../../ui/viewer-stack-tags/viewer-source-tags-ui");
function createSourceTagRuntime() {
    const script = (0, viewer_source_tags_1.getSourceTagsScript)();
    const factory = new Function(`
        var document = { getElementById: function() { return null; } };
        var window = {};
        var allLines = [];
        var vscodeApi = { postMessage: function() {} };
        function stripTags(s) { var t = String(s || '').replace(/<[^>]*>/g, ''); return t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }
        ${script}
        return { parseSourceTag, isNoisySourceTag, getSourceTagChipKeys, sourceTagCounts, otherKey };
    `);
    return factory();
}
suite('Viewer Source Tags Noise Guard', () => {
    test('parseSourceTag rejects noisy tags and preserves useful tags', () => {
        const runtime = createSourceTagRuntime();
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): [08:45:23.606] tick'), null);
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): [isamigrationcompleted] done'), 'isamigrationcompleted');
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): Drift: Sent SELECT * FROM users'), 'database');
        assert.strictEqual(runtime.isNoisySourceTag('08:45:23.606'), true);
        assert.strictEqual(runtime.isNoisySourceTag('wm-greedyscheduler'), false);
    });
    test('shared chip-eligibility helper excludes low-frequency and other tags', () => {
        const runtime = createSourceTagRuntime();
        runtime.sourceTagCounts[runtime.otherKey] = 999;
        runtime.sourceTagCounts.flutter = 10;
        runtime.sourceTagCounts.android = 1;
        runtime.sourceTagCounts.facebook = 2;
        const keys = runtime.getSourceTagChipKeys().sort((a, b) => a.localeCompare(b));
        assert.deepStrictEqual(keys, ['facebook', 'flutter']);
    });
    test('source tag UI uses shared chip-eligibility helper', () => {
        const uiScript = (0, viewer_source_tags_ui_1.getSourceTagUiScript)();
        assert.ok(uiScript.includes('getSourceTagChipKeys'));
        assert.ok(uiScript.includes('Show all ('));
    });
});
//# sourceMappingURL=viewer-source-tags-noise.test.js.map