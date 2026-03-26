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
const viewer_styles_1 = require("../../ui/viewer-styles/viewer-styles");
const viewer_script_1 = require("../../ui/viewer/viewer-script");
suite('ViewerJumpScrollPlacement', () => {
    test('getViewerStyles jump rules use fixed + opacity-only animation before JS sync', () => {
        const full = (0, viewer_styles_1.getViewerStyles)();
        assert.ok(full.includes('#jump-btn, #jump-top-btn'));
        assert.ok(full.includes('position: fixed'));
        assert.ok(full.includes('jump-btn-fade-in'));
    });
    test('viewer script uses fixed positioning from #log-content getBoundingClientRect', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(script.includes('function syncJumpButtonInset'));
        assert.ok(script.includes("setProperty('position', 'fixed'"));
        assert.ok(script.includes('getBoundingClientRect'));
        assert.ok(script.includes('important'));
    });
    test('embedded viewer script contains no backticks (regression: TS template literal must not break)', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.strictEqual(script.includes('`'), false, 'a backtick inside the emitted string would terminate the TypeScript template literal');
    });
    test('syncJumpButtonInset accounts for replay bar visibility nudge', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(script.includes('replay-bar-visible'));
        assert.ok(script.includes('replayNudge'));
    });
    test('syncJumpButtonInset still anchors controls from log-content rect', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(script.includes('syncJumpButtonInset'));
        assert.ok(script.includes('getBoundingClientRect'));
    });
    test('syncJumpButtonInset does not include removed log-compress-toggle anchoring', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(!script.includes("var logCompressToggle = document.getElementById('log-compress-toggle');"));
        assert.ok(!script.includes("if (logCompressToggle) {"));
        assert.ok(!script.includes("logCompressToggle.style.setProperty('position', 'fixed', 'important');"));
        assert.ok(!script.includes("logCompressToggle.style.setProperty('left'"));
        assert.ok(!script.includes("logCompressToggle.style.setProperty('top'"));
    });
    test('compress toggle click wiring is removed from viewer script', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(!script.includes("if (logCompressToggle) logCompressToggle.addEventListener('click', function(e) {"), 'removed button must not keep listener wiring');
        assert.ok(!script.includes("if (typeof toggleCompressLines === 'function') toggleCompressLines();"), 'viewer script should not contain the removed button click handler branch');
        assert.ok(!script.includes("if (jumpBtn) jumpBtn.addEventListener('click', function(e) {"), 'false-positive guard: jump button wiring remains separate');
    });
    test('layout sync is scheduled after paint via chained requestAnimationFrame', () => {
        const script = (0, viewer_script_1.getViewerScript)(5000);
        assert.ok(script.includes('requestAnimationFrame(function() { requestAnimationFrame(syncJumpButtonInset); })'));
    });
});
//# sourceMappingURL=viewer-jump-anchor-styles.test.js.map