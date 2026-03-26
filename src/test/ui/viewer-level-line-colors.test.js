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
suite('ViewerLevelLineColors', () => {
    test('info + performance lines share debugConsole.infoForeground (not terminal yellow)', () => {
        const css = (0, viewer_styles_1.getViewerStyles)();
        const combinedRe = /\.line\.level-performance,\s*\.line\.level-info\s*\{[^}]*debugConsole-infoForeground/s;
        const combined = combinedRe.exec(css);
        assert.ok(combined, 'expected one shared rule for perf + info using debug console info token');
        const blockRe = /\.line\.level-performance,\s*\.line\.level-info\s*\{[^}]*\}/s;
        const block = blockRe.exec(css);
        if (block === null) {
            assert.fail('expected combined perf/info CSS block');
        }
        assert.ok(!block[0].includes('terminal-ansiYellow'), 'perf/info line color must not use terminal-ansiYellow');
    });
    test('debug lines still use terminal yellow (unchanged level palette)', () => {
        const css = (0, viewer_styles_1.getViewerStyles)();
        assert.ok(css.includes('.line.level-debug'));
        const debugRe = /\.line\.level-debug\s*\{[^}]*terminal-ansiYellow/s;
        assert.ok(debugRe.exec(css), 'debug lines should keep terminal-ansiYellow');
    });
});
//# sourceMappingURL=viewer-level-line-colors.test.js.map