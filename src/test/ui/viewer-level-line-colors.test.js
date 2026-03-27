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
const viewer_styles_decoration_1 = require("../../ui/viewer-styles/viewer-styles-decoration");
const viewer_styles_1 = require("../../ui/viewer-styles/viewer-styles");
suite('ViewerLevelLineColors', () => {
    test('info line text matches info severity bar token (debug console info)', () => {
        const viewer = (0, viewer_styles_1.getViewerStyles)();
        const deco = (0, viewer_styles_decoration_1.getDecorationStyles)();
        assert.ok(/\.line\.level-info\s*\{[^}]*debugConsole-infoForeground/s.test(viewer), 'info line text should use debugConsole-infoForeground');
        assert.ok(/\.level-bar-info\s*\{[^}]*debugConsole-infoForeground/s.test(deco), 'info severity bar should use the same token as info line text');
        assert.ok(!/\.level-bar-info\s*\{[^}]*charts-yellow/s.test(deco), 'regression: info bar must not use charts-yellow while text uses debugConsole-infoForeground');
    });
    test('performance line text uses charts purple to match performance bar', () => {
        const viewer = (0, viewer_styles_1.getViewerStyles)();
        const deco = (0, viewer_styles_decoration_1.getDecorationStyles)();
        assert.ok(/\.line\.level-performance\s*\{[^}]*charts-purple/s.test(viewer), 'performance line color should match level-bar-performance');
        assert.ok(/\.level-bar-performance\s*\{[^}]*charts-purple/s.test(deco), 'performance bar should stay charts-purple alongside performance line text');
        assert.ok(!/\.line\.level-performance\s*\{[^}]*debugConsole-infoForeground/s.test(viewer), 'regression: performance line must not share infoForeground with info (distinct purple level)');
    });
    test('error and warning severity bars use debug console tokens (match line text)', () => {
        const deco = (0, viewer_styles_decoration_1.getDecorationStyles)();
        assert.ok(/\.level-bar-error\s*\{[^}]*debugConsole-errorForeground/s.test(deco), 'error bar should align with .line.level-error');
        assert.ok(/\.level-bar-warning\s*\{[^}]*debugConsole-warningForeground/s.test(deco), 'warning bar should align with .line.level-warning');
    });
    test('debug lines still use terminal yellow (unchanged level palette)', () => {
        const css = (0, viewer_styles_1.getViewerStyles)();
        assert.ok(css.includes('.line.level-debug'));
        const debugRe = /\.line\.level-debug\s*\{[^}]*terminal-ansiYellow/s;
        assert.ok(debugRe.exec(css), 'debug lines should keep terminal-ansiYellow');
    });
});
//# sourceMappingURL=viewer-level-line-colors.test.js.map