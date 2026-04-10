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
 * Regression tests for framework line rendering in `renderItem` (embedded webview script).
 *
 * The tier system handles device-line severity: device-other lines have their level
 * demoted to `info` in `addToData()`, so `renderItem` no longer needs `fwMuted` logic.
 * These tests verify the old per-render muting is gone and the bar still derives from `item.level`.
 */
const assert = __importStar(require("node:assert"));
const viewer_data_helpers_render_1 = require("../../ui/viewer/viewer-data-helpers-render");
suite('viewer-data-helpers-render framework severity (tier system)', () => {
    const renderChunk = (0, viewer_data_helpers_render_1.getViewerDataHelpersRender)();
    test('fwMuted variable should not exist (tier system handles severity demotion)', () => {
        assert.ok(!renderChunk.includes('fwMuted'), 'renderItem must not contain fwMuted — device-other severity is demoted in addToData()');
    });
    test('deemphasizeFrameworkLevels should not appear in render script', () => {
        assert.ok(!renderChunk.includes('deemphasizeFrameworkLevels'), 'renderItem must not reference the deprecated deemphasizeFrameworkLevels setting');
    });
    /**
     * Before the tier system: `barCls` picked `level-bar-framework` (charts blue) when `item.fw && !hasSeverity`,
     * while `levelCls` still applied `level-debug` / `level-info` — blue bar + yellow text on Android D/ lines.
     * After: bar is always `level-bar-` + `item.level` (except recent-error-context), matching gutter CSS to line text.
     */
    test('severity bar uses level-bar-{level} for framework lines (matches level-* text)', () => {
        assert.ok(!renderChunk.includes("' level-bar-framework'"), 'gutter must not use level-bar-framework when item.fw; bar color should match level-debug/info/etc.');
        assert.ok(renderChunk.includes("' level-bar-' + item.level"), 'bar class must derive from item.level');
    });
});
//# sourceMappingURL=viewer-data-helpers-render-fw-muted.test.js.map