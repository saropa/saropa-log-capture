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
 * Tests for severity bar connector logic and hidden-lines chevron.
 *
 * Covers the viewport rendering script: same-level dot joining, blank-line
 * skipping, hidden-lines chevron insertion, and tooltip reason aggregation.
 * Uses string-includes assertions on the generated webview JS (same pattern
 * as viewer-data-helpers-render-fw-muted.test.ts).
 */
const assert = __importStar(require("node:assert"));
const viewer_data_viewport_1 = require("../../ui/viewer/viewer-data-viewport");
const viewer_data_helpers_render_1 = require("../../ui/viewer/viewer-data-helpers-render");
const viewer_styles_decoration_1 = require("../../ui/viewer-styles/viewer-styles-decoration");
suite('Severity bar connector (same-level joining)', () => {
    const viewportScript = (0, viewer_data_viewport_1.getViewportRenderScript)();
    test('should use findNextDotSibling instead of findNextBarSibling', () => {
        assert.ok(viewportScript.includes('function findNextDotSibling('), 'viewport script must define findNextDotSibling');
        assert.ok(!viewportScript.includes('function findNextBarSibling('), 'old findNextBarSibling must be removed');
    });
    test('should skip blank lines when finding next dot', () => {
        assert.ok(viewportScript.includes("classList.contains('line-blank')"), 'findNextDotSibling must skip blank lines');
    });
    test('should skip hidden-chevron elements in dot search', () => {
        assert.ok(viewportScript.includes("classList.contains('hidden-chevron')"), 'findNextDotSibling must skip hidden-chevron elements');
    });
    test('should only connect dots with the same bar level', () => {
        assert.ok(viewportScript.includes('nextLvl !== lvl'), 'connector loop must compare adjacent dot levels and skip mismatches');
    });
    test('should still stop connector chain at markers', () => {
        assert.ok(viewportScript.includes("classList.contains('marker')"), 'dot search must stop at markers to break connector chain at session boundaries');
    });
});
suite('Hidden-lines chevron insertion', () => {
    const viewportScript = (0, viewer_data_viewport_1.getViewportRenderScript)();
    test('should define countHiddenNonBlank helper', () => {
        assert.ok(viewportScript.includes('function countHiddenNonBlank('), 'viewport script must define countHiddenNonBlank');
    });
    test('should skip blank lines in hidden count', () => {
        assert.ok(viewportScript.includes('isLineContentBlank(item)'), 'countHiddenNonBlank must exclude blank lines');
    });
    test('should cover all calcItemHeight filter flags in reason tracking', () => {
        // These flags are checked in calcItemHeight; countHiddenNonBlank must track each.
        const requiredFlags = [
            'levelFiltered', 'excluded', 'filteredOut', 'sourceFiltered',
            'searchFiltered', 'errorSuppressed', 'repeatHidden',
            'compressDupHidden', 'scopeFiltered', 'timeRangeFiltered',
            'classFiltered', 'sqlPatternFiltered',
        ];
        for (const flag of requiredFlags) {
            assert.ok(viewportScript.includes(`item.${flag}`), `countHiddenNonBlank must check item.${flag}`);
        }
    });
    test('should check userHidden and autoHidden for manual/auto-hide', () => {
        assert.ok(viewportScript.includes('item.userHidden') && viewportScript.includes('item.autoHidden'), 'must check both userHidden and autoHidden flags');
    });
    test('should check tier-based filter via isTierHidden', () => {
        assert.ok(viewportScript.includes('isTierHidden'), 'must check tier filter via isTierHidden function');
    });
    test('should define buildHiddenTip for tooltip formatting', () => {
        assert.ok(viewportScript.includes('function buildHiddenTip('), 'viewport script must define buildHiddenTip');
    });
    test('should insert chevron HTML with title on the span element', () => {
        assert.ok(viewportScript.includes('hidden-chevron'), 'render loop must insert hidden-chevron div');
        assert.ok(viewportScript.includes('<span title="'), 'title attribute must be on the inner span for reliable tooltip hit-testing');
    });
    test('should use prevVisIdx to detect gaps between visible lines', () => {
        assert.ok(viewportScript.includes('prevVisIdx'), 'render loop must track previous visible line index');
    });
    test('should build singular/plural tooltip text', () => {
        // "1 hidden line" vs "N hidden lines"
        assert.ok(viewportScript.includes("n !== 1 ? 's' : ''"), 'buildHiddenTip must pluralise correctly');
    });
});
suite('renderItem blank-line bar class removal', () => {
    const renderChunk = (0, viewer_data_helpers_render_1.getViewerDataHelpersRender)();
    test('should not inherit bar class from previous line for blank lines', () => {
        // Before: blank lines inherited level-bar-* via `var prevLn = allLines[idx - 1]`.
        // After: blank lines get no bar class; the bridge logic in renderViewport() handles it.
        // The `prevLn` variable was only used for blank-line bar inheritance.
        assert.ok(!renderChunk.includes('prevLn'), 'renderItem must not use prevLn for blank-line bar class inheritance');
    });
    test('should still assign bar class for non-blank lines with a level', () => {
        assert.ok(renderChunk.includes("barCls = ' level-bar-' + item.level"), 'non-blank lines must still get level-bar-{level} class');
    });
    test('should still preserve tint inheritance for blank lines', () => {
        // Tint CSS class (line-tint-*) is separate from bar class.
        assert.ok(renderChunk.includes("tintCls = ' line-tint-' + allLines[idx - 1].level"), 'blank line tint must still inherit from previous line');
    });
});
suite('Hidden-chevron CSS', () => {
    const css = (0, viewer_styles_decoration_1.getDecorationStyles)();
    test('should define hidden-chevron styles', () => {
        assert.ok(css.includes('.hidden-chevron'), 'CSS must define .hidden-chevron');
        assert.ok(css.includes('.hidden-chevron > span'), 'CSS must style the inner span');
    });
    test('should use zero height with overflow visible', () => {
        assert.ok(css.includes('height: 0') && css.includes('overflow: visible'), 'hidden-chevron div must be zero-height with visible overflow');
    });
    test('should not use font-size: 0 on parent (breaks child em units)', () => {
        // Regression: font-size: 0 on parent makes 0.75em = 0px on child.
        const chevronBlock = css.slice(css.indexOf('.hidden-chevron {'), css.indexOf('.hidden-chevron > span'));
        assert.ok(!chevronBlock.includes('font-size: 0'), 'parent .hidden-chevron must not set font-size: 0');
    });
    test('should position span absolutely for gutter placement', () => {
        assert.ok(css.includes('position: absolute'), 'inner span must be absolutely positioned');
    });
});
//# sourceMappingURL=viewer-severity-bar-connector.test.js.map