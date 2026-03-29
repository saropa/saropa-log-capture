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
/**
 * Regression tests for `fwMuted` in `renderItem` (embedded webview script).
 *
 * `saropaLogCapture.deemphasizeFrameworkLevels` must mute framework **error/warning** text colors
 * only — not **performance** (Choreographer jank, etc.). Assertions use string includes on the
 * emitted script (same pattern as viewer-compress-and-search-styles.test.ts).
 */
const assert = __importStar(require("node:assert"));
const viewer_data_helpers_render_1 = require("../../ui/viewer/viewer-data-helpers-render");
suite('viewer-data-helpers-render fwMuted (framework deemphasize)', () => {
    const renderChunk = (0, viewer_data_helpers_render_1.getViewerDataHelpersRender)();
    test('fwMuted gates on error or warning level when framework + deemphasize', () => {
        assert.ok(renderChunk.includes("item.level === 'error' || item.level === 'warning'"), 'fwMuted must only apply to framework error/warning lines');
        assert.ok(renderChunk.includes('deemphasizeFrameworkLevels') && renderChunk.includes('item.fw'), 'fwMuted must still consider deemphasize + framework flag');
    });
    test('does not use framework-only mute (before: all fw levels lost line colors)', () => {
        /* Regression: prior implementation closed with `&& item.fw);` — no level branch. */
        assert.ok(!renderChunk.includes('deemphasizeFrameworkLevels && item.fw);'), 'must not end fwMuted immediately after item.fw (performance would stay muted)');
    });
    /**
     * Before: `barCls` picked `level-bar-framework` (charts blue) when `item.fw && !hasSeverity`,
     * while `levelCls` still applied `level-debug` / `level-info` — blue bar + yellow text on Android D/ lines.
     * After: bar is always `level-bar-` + `item.level` (except recent-error-context), matching gutter CSS to line text.
     */
    test('severity bar uses level-bar-{level} for framework lines (matches level-* text)', () => {
        assert.ok(!renderChunk.includes("' level-bar-framework'"), 'gutter must not use level-bar-framework when item.fw; bar color should match level-debug/info/etc.');
        assert.ok(renderChunk.includes("' level-bar-' + item.level"), 'bar class must derive from item.level');
    });
});
//# sourceMappingURL=viewer-data-helpers-render-fw-muted.test.js.map