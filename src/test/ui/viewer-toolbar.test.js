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
const viewer_toolbar_html_1 = require("../../ui/viewer-toolbar/viewer-toolbar-html");
const viewer_toolbar_filter_drawer_html_1 = require("../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html");
const viewer_toolbar_actions_html_1 = require("../../ui/viewer-toolbar/viewer-toolbar-actions-html");
/**
 * Tests for the toolbar, search flyout, filter drawer, and actions dropdown.
 *
 * Verifies that all required DOM element IDs are preserved so existing
 * webview scripts continue to bind correctly.
 */
suite('Viewer toolbar', () => {
    function readSrc(relFromSrc) {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }
    test('toolbar HTML preserves required element IDs', () => {
        const html = (0, viewer_toolbar_html_1.getToolbarHtml)({ version: '1.0.0' });
        const required = [
            'id="viewer-toolbar"',
            'id="toolbar-search-btn"',
            'id="toolbar-filter-btn"',
            'id="toolbar-actions-btn"',
            'id="level-menu-btn"',
            'id="line-count"',
            'id="hidden-lines-counter"',
            'id="footer-selection"',
            'id="filter-badge"',
            'id="footer-text"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `toolbar must contain ${id}`);
        }
    });
    test('toolbar HTML has data-version attribute', () => {
        const html = (0, viewer_toolbar_html_1.getToolbarHtml)({ version: '4.2.0' });
        assert.ok(html.includes('data-version="v4.2.0"'), 'data-version should be set');
    });
    test('toolbar fixed elements are in toolbar-left, filename in toolbar-right', () => {
        const html = (0, viewer_toolbar_html_1.getToolbarHtml)({ version: '1.0.0' });
        const leftIdx = html.indexOf('toolbar-left');
        const rightIdx = html.indexOf('toolbar-right');
        const filenameIdx = html.indexOf('toolbar-filename');
        assert.ok(leftIdx < rightIdx, 'toolbar-left should precede toolbar-right');
        assert.ok(filenameIdx > rightIdx, 'filename should be in toolbar-right');
    });
    test('filter drawer HTML preserves required element IDs', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        const required = [
            'id="filter-drawer"',
            'id="level-select-all"',
            'id="level-select-none"',
            'id="context-lines-slider"',
            'id="context-lines-label"',
            'id="opt-app-only"',
            'id="preset-select"',
            'id="reset-all-filters"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `filter drawer must contain ${id}`);
        }
    });
    test('filter drawer has accordion sections', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(html.includes('filter-accordion'), 'filter drawer should have accordion sections');
        assert.ok(html.includes('filter-accordion-header'), 'accordion sections need clickable headers');
    });
    test('actions dropdown preserves replay script IDs', () => {
        const html = (0, viewer_toolbar_actions_html_1.getActionsDropdownHtml)();
        assert.ok(html.includes('id="footer-actions-menu"'), 'replay compat: menu ID');
        assert.ok(html.includes('id="footer-actions-popover"'), 'replay compat: popover ID');
        assert.ok(html.includes('data-action="replay"'), 'replay action button');
        assert.ok(html.includes('data-action="export"'), 'export action button');
    });
    test('content body wires toolbar, flyout, drawer, and actions', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(src.includes('getToolbarHtml'), 'body should import toolbar');
        assert.ok(src.includes('getSearchFlyoutHtml'), 'body should import search flyout');
        assert.ok(src.includes('getFilterDrawerHtml'), 'body should import filter drawer');
        assert.ok(src.includes('getActionsDropdownHtml'), 'body should import actions');
    });
    test('content body does not include old footer or filters panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(!src.includes('id="footer"'), 'old footer removed');
        assert.ok(!src.includes('getFiltersPanelHtml'), 'filters panel removed from body');
    });
    test('icon bar has no Filters or SQL Filter buttons', () => {
        const src = readSrc('ui/viewer-nav/viewer-icon-bar.ts');
        assert.ok(!src.includes('id="ib-filters"'), 'Filters button removed');
        assert.ok(!src.includes('id="ib-sql-filter"'), 'SQL Filter button removed');
    });
    test('toolbar script provides backward compat aliases', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(src.includes('window.openFiltersPanel'), 'openFiltersPanel alias');
        assert.ok(src.includes('window.closeFiltersPanel'), 'closeFiltersPanel alias');
        assert.ok(src.includes('window.openFilterDrawer'), 'openFilterDrawer export');
        assert.ok(src.includes('window.closeFilterDrawer'), 'closeFilterDrawer export');
        assert.ok(src.includes('window.toggleSearchFlyout'), 'toggleSearchFlyout export');
        assert.ok(src.includes('window.setFooterActionsOpen'), 'setFooterActionsOpen compat');
    });
    test('toolbar script has Signals mutual exclusion', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(src.includes('signalsWasVisible'), 'should track signals visibility');
        assert.ok(src.includes('root-cause-hypotheses'), 'should reference signals host');
    });
    test('about panel reads version from toolbar, not footer', () => {
        const src = readSrc('ui/viewer-panels/viewer-about-panel.ts');
        assert.ok(src.includes("getElementById('viewer-toolbar')"), 'about panel should read version from toolbar');
        assert.ok(!src.includes("getElementById('footer-text')"), 'about panel should not reference old footer-text for version');
    });
    test('viewer-script uses toolbar element for paused state', () => {
        const src = readSrc('ui/viewer/viewer-script.ts');
        assert.ok(src.includes("getElementById('viewer-toolbar')"), 'viewer-script should use toolbar for paused class toggle');
    });
    test('filter badge click opens filter drawer', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-filter-badge.ts');
        assert.ok(src.includes('openFilterDrawer'), 'badge click should open filter drawer');
        assert.ok(!src.includes("setActivePanel('filters')"), 'badge should not open old filters panel');
    });
    test('level filter delegates to filter drawer', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-level-filter.ts');
        assert.ok(src.includes('toggleFilterDrawer'), 'toggleLevelMenu should delegate to toggleFilterDrawer');
        assert.ok(!src.includes("getElementById('level-flyup')"), 'should not reference removed #level-flyup element');
    });
});
//# sourceMappingURL=viewer-toolbar.test.js.map