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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const viewer_styles_toolbar_1 = require("../../ui/viewer-styles/viewer-styles-toolbar");
const viewer_styles_filter_drawer_1 = require("../../ui/viewer-styles/viewer-styles-filter-drawer");
const viewer_styles_root_cause_hints_1 = require("../../ui/viewer-styles/viewer-styles-root-cause-hints");
const viewer_toolbar_filter_drawer_html_1 = require("../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html");
/**
 * Tests for toolbar animation CSS and JS wiring.
 *
 * Verifies that keyframe definitions, animation classes, reduced-motion
 * overrides, and script-side animation helpers are present and correct.
 */
suite('Viewer toolbar animations', () => {
    function readSrc(relFromSrc) {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }
    /* ---- CSS: Toolbar styles keyframes ---- */
    suite('toolbar styles CSS', () => {
        let css;
        setup(() => { css = (0, viewer_styles_toolbar_1.getToolbarStyles)(); });
        test('should define flyout-open and flyout-close keyframes', () => {
            assert.ok(css.includes('@keyframes flyout-open'), 'flyout-open keyframe');
            assert.ok(css.includes('@keyframes flyout-close'), 'flyout-close keyframe');
        });
        test('should define dropdown-open and dropdown-close keyframes', () => {
            assert.ok(css.includes('@keyframes dropdown-open'), 'dropdown-open keyframe');
            assert.ok(css.includes('@keyframes dropdown-close'), 'dropdown-close keyframe');
        });
        test('should have animation classes with correct fill modes', () => {
            assert.match(css, /\.anim-flyout-open\s*\{[^}]*backwards/s, 'flyout open: backwards fill');
            assert.match(css, /\.anim-flyout-close\s*\{[^}]*forwards/s, 'flyout close: forwards fill');
            assert.match(css, /\.anim-dropdown-open\s*\{[^}]*backwards/s, 'dropdown open: backwards fill');
            assert.match(css, /\.anim-dropdown-close\s*\{[^}]*forwards/s, 'dropdown close: forwards fill');
        });
        test('should set transform-origin: top on actions popover', () => {
            assert.match(css, /\.toolbar-actions-popover\s*\{[^}]*transform-origin:\s*top/s, 'actions popover needs transform-origin: top for scaleY animation');
        });
        test('should put underline on .footer-filename, not .toolbar-filename', () => {
            assert.ok(!css.match(/\.toolbar-filename\s*\{[^}]*text-decoration:\s*underline/s), '.toolbar-filename must not have text-decoration: underline (moved to .footer-filename)');
            assert.match(css, /\.footer-filename\s*\{[^}]*text-decoration:\s*underline/s, '.footer-filename should have text-decoration: underline');
            assert.match(css, /\.footer-filename\s*\{[^}]*text-decoration-style:\s*dotted/s, '.footer-filename should have dotted underline');
        });
        test('hover should change .footer-filename underline to solid', () => {
            assert.match(css, /\.toolbar-filename:hover\s+\.footer-filename\s*\{[^}]*text-decoration-style:\s*solid/s, 'parent hover should switch child underline to solid');
        });
        test('reduced-motion media query should cover all animation classes', () => {
            assert.match(css, /prefers-reduced-motion.*anim-flyout-open/s, 'reduced motion must cover anim-flyout-open');
            assert.match(css, /prefers-reduced-motion.*anim-dropdown-close/s, 'reduced motion must cover anim-dropdown-close');
        });
    });
    /* ---- CSS: Filter drawer accordion transitions ---- */
    suite('filter drawer styles CSS', () => {
        let css;
        setup(() => { css = (0, viewer_styles_filter_drawer_1.getFilterDrawerStyles)(); });
        test('accordion body should default to max-height: 0 (not display: none)', () => {
            assert.match(css, /\.filter-accordion-body\s*\{[^}]*max-height:\s*0/s, 'accordion body default: max-height: 0');
            assert.ok(!css.includes('.filter-accordion-body[hidden]'), 'should not use [hidden] selector for accordion body');
        });
        test('accordion body should have transition on max-height and opacity', () => {
            assert.match(css, /\.filter-accordion-body\s*\{[^}]*transition:[^}]*max-height/s, 'accordion body needs max-height transition');
            assert.match(css, /\.filter-accordion-body\s*\{[^}]*transition:[^}]*opacity/s, 'accordion body needs opacity transition');
        });
        test('expanded accordion body should allow scrolling', () => {
            assert.match(css, /\.filter-accordion\.expanded\s+\.filter-accordion-body\s*\{[^}]*overflow-y:\s*auto/s, 'expanded body needs overflow-y: auto for long content');
        });
        test('reduced-motion should disable accordion body transitions', () => {
            assert.match(css, /prefers-reduced-motion.*\.filter-accordion-body/s, 'reduced motion must cover accordion body transitions');
        });
    });
    /* ---- CSS: Signals collapse class ---- */
    suite('Signals styles CSS', () => {
        let css;
        setup(() => { css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)(); });
        test('should define signals-drawer-hidden collapse class', () => {
            assert.match(css, /\.root-cause-hypotheses\.signals-drawer-hidden\s*\{/, 'signals-drawer-hidden class must exist');
        });
        test('signals-drawer-hidden should set max-height: 0 and opacity: 0', () => {
            assert.match(css, /signals-drawer-hidden\s*\{[^}]*max-height:\s*0/s, 'must collapse height');
            assert.match(css, /signals-drawer-hidden\s*\{[^}]*opacity:\s*0/s, 'must fade out');
        });
        test('should have transition on root-cause-hypotheses for smooth collapse', () => {
            assert.match(css, /\.root-cause-hypotheses\s*\{[^}]*transition:[^}]*max-height/s, 'signals needs max-height transition');
        });
        test('reduced-motion should disable signals transitions', () => {
            assert.match(css, /prefers-reduced-motion.*\.root-cause-hypotheses/s, 'reduced motion must cover signals transitions');
        });
    });
    /* ---- JS: Toolbar script animation helpers ---- */
    suite('toolbar script animation wiring', () => {
        let src;
        setup(() => { src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts'); });
        test('should have animatedShow and animatedHide helpers', () => {
            assert.ok(src.includes('function animatedShow'), 'animatedShow helper');
            assert.ok(src.includes('function animatedHide'), 'animatedHide helper');
        });
        test('should check prefers-reduced-motion', () => {
            assert.ok(src.includes('prefers-reduced-motion'), 'script must check reduced motion preference');
        });
        test('should use anim-flyout-open for search and filter drawer', () => {
            assert.ok(src.includes("animatedShow(searchFlyout, 'anim-flyout-open')"), 'search flyout opens with animation');
            assert.ok(src.includes("animatedShow(filterDrawer, 'anim-flyout-open')"), 'filter drawer opens with animation');
        });
        test('should use anim-flyout-close for search and filter drawer', () => {
            assert.ok(src.includes("animatedHide(searchFlyout, 'anim-flyout-close')"), 'search flyout closes with animation');
            assert.ok(src.includes("animatedHide(filterDrawer, 'anim-flyout-close')"), 'filter drawer closes with animation');
        });
        test('should use signals-drawer-hidden instead of u-hidden for Signals', () => {
            assert.ok(src.includes("classList.add('signals-drawer-hidden')"), 'signals collapse should use signals-drawer-hidden');
            assert.ok(src.includes("classList.remove('signals-drawer-hidden')"), 'signals restore should remove signals-drawer-hidden');
        });
        test('accordion should not use body.hidden', () => {
            assert.ok(!src.includes('body.hidden'), 'accordion must not set body.hidden (CSS max-height handles visibility)');
        });
        test('actions popover should have animationend handler for toolbar-actions-open', () => {
            assert.ok(src.includes("remove('toolbar-actions-open'"), 'actions close animation must remove toolbar-actions-open on end');
        });
    });
    /* ---- HTML: Accordion body has no hidden attribute ---- */
    test('filter drawer accordion bodies should not have hidden attribute', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(!html.includes('filter-accordion-body" hidden'), 'accordion body must not use hidden attribute (CSS max-height handles visibility)');
    });
});
//# sourceMappingURL=viewer-toolbar-animations.test.js.map