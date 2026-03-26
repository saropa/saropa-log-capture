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
const viewer_data_viewport_1 = require("../../ui/viewer/viewer-data-viewport");
const viewer_script_1 = require("../../ui/viewer/viewer-script");
/**
 * Regression: filtered logs (many height-0 lines) used index-based viewport hysteresis,
 * causing full DOM rebuild every scroll frame and severe flicker. Tail-follow also
 * flipped when distance-to-bottom jittered. See viewer-data-viewport + viewer-script.
 */
suite('ViewerScrollBehavior', () => {
    const maxLines = 100_000;
    test('viewport script skips rebuild only when visible range unchanged (not index slack)', () => {
        const script = (0, viewer_data_viewport_1.getViewportRenderScript)();
        assert.ok(script.includes('startIdx === lastStart && endIdx === lastEnd'), 'expected equality-based skip to avoid filter-mode flicker');
        assert.ok(script.includes('height 0'), 'expected comment documenting filtered-view failure mode');
        assert.ok(!script.includes('Math.abs(startIdx - lastStart)'), 'index-delta hysteresis must not remain');
    });
    test('viewer script uses Schmitt-trigger thresholds for tail-follow', () => {
        const script = (0, viewer_script_1.getViewerScript)(maxLines);
        assert.ok(script.includes('AT_BOTTOM_ON_PX'));
        assert.ok(script.includes('AT_BOTTOM_OFF_PX'));
        assert.ok(script.includes('Schmitt-trigger'));
        assert.ok(script.includes('distBottom'));
    });
});
//# sourceMappingURL=viewer-scroll-behavior.test.js.map