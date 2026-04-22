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
    /* ---- CSS: Filter drawer tab bar styles ---- */
    suite('filter drawer styles CSS', () => {
        let css;
        setup(() => { css = (0, viewer_styles_filter_drawer_1.getFilterDrawerStyles)(); });
        test('tab layout should use flex row for sidebar + panels', () => {
            assert.match(css, /\.filter-tab-layout\s*\{[^}]*display:\s*flex/s, 'tab layout needs flex for horizontal sidebar + panel arrangement');
        });
        test('tab bar should use vertical flex-direction', () => {
            assert.match(css, /\.filter-tab-bar\s*\{[^}]*flex-direction:\s*column/s, 'tab bar needs vertical column layout');
        });
        test('tab panels container should scroll independently', () => {
            assert.match(css, /\.filter-tab-panels\s*\{[^}]*overflow-y:\s*auto/s, 'tab panels container needs overflow-y: auto for scrolling');
            assert.match(css, /\.filter-tab-panels\s*\{[^}]*flex:\s*1/s, 'tab panels container should fill remaining width');
        });
        test('active tab should have bottom border indicator', () => {
            assert.match(css, /\.filter-tab\[aria-selected="true"\]/s, 'active tab needs aria-selected style rule');
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
        test('should use anim-flyout-open for search flyout', () => {
            assert.ok(src.includes("animatedShow(searchFlyout, 'anim-flyout-open')"), 'search flyout opens with animation');
        });
        test('should use anim-flyout-close for search flyout', () => {
            assert.ok(src.includes("animatedHide(searchFlyout, 'anim-flyout-close')"), 'search flyout closes with animation');
        });
        test('filter panel should use setActivePanel instead of animations', () => {
            /* Filter panel is now a panel-slot slide-out, not a dropdown.
             * It opens via setActivePanel('filters'), not animatedShow. */
            assert.ok(src.includes("setActivePanel('filters')"), 'filter button should toggle via setActivePanel');
        });
        test('should not export showSignalsPanel to window', () => {
            assert.ok(!src.includes('window.showSignalsPanel'), 'showSignalsPanel must not be exported — panel is only opened via toggleSignalsPanel');
        });
        test('tab switching should use style.display not hidden attribute', () => {
            assert.ok(!src.includes('body.hidden'), 'tab panels must not use body.hidden for visibility');
        });
        test('actions popover should have animationend handler for toolbar-actions-open', () => {
            assert.ok(src.includes("remove('toolbar-actions-open'"), 'actions close animation must remove toolbar-actions-open on end');
        });
    });
    /* ---- HTML: Tab panels use style display for visibility ---- */
    test('filter drawer tab panels should not have hidden attribute', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(!html.includes('filter-tab-panel" hidden'), 'tab panels must not use hidden attribute (style.display handles visibility)');
    });
});
//# sourceMappingURL=viewer-toolbar-animations.test.js.map