import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getToolbarHtml } from '../../ui/viewer-toolbar/viewer-toolbar-html';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getActionsDropdownHtml } from '../../ui/viewer-toolbar/viewer-toolbar-actions-html';
import { getLevelStyles } from '../../ui/viewer-styles/viewer-styles-level';

/**
 * Structure and integration tests for the toolbar, filter drawer, and actions dropdown.
 *
 * Verifies that all required DOM element IDs are preserved so existing
 * webview scripts continue to bind correctly.
 * Tooltip tests are in viewer-toolbar-tooltips.test.ts.
 */
suite('Viewer toolbar', () => {

    function readSrc(relFromSrc: string): string {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }

    test('toolbar level summary nests letter + count inside one pill (bug 006)', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        // The prefix letter now lives INSIDE the count pill (.dot-count-letter), with the
        // number in a sibling .dot-count-num span the count-writer targets. Assert the pill
        // opens with its per-level class and immediately contains the letter chip.
        const snippets = [
            'class="dot-count dot-count-error"><span class="dot-count-letter">E</span><span class="dot-count-num"',
            'class="dot-count dot-count-warning"><span class="dot-count-letter">W</span><span class="dot-count-num"',
            'class="dot-count dot-count-info"><span class="dot-count-letter">I</span><span class="dot-count-num"',
            'class="dot-count dot-count-performance"><span class="dot-count-letter">P</span><span class="dot-count-num"',
            'class="dot-count dot-count-todo"><span class="dot-count-letter">T</span><span class="dot-count-num"',
            'class="dot-count dot-count-notice"><span class="dot-count-letter">N</span><span class="dot-count-num"',
            'class="dot-count dot-count-debug"><span class="dot-count-letter">D</span><span class="dot-count-num"',
            'class="dot-count dot-count-database"><span class="dot-count-letter">DB</span><span class="dot-count-num"',
        ];
        for (const s of snippets) {
            assert.ok(html.includes(s), `toolbar HTML should contain: ${s}`);
        }
        const css = getLevelStyles();
        // The in-pill letter must NOT set its own color — it inherits the pill's per-level
        // contrasting foreground so letter and number match. A stray .level-letter-* color
        // rule would break that, so assert the old level-colored letter class is gone.
        assert.ok(css.includes('.dot-count-letter'), 'level CSS should style the in-pill letter');
        assert.ok(
            !css.includes('.level-letter-error'),
            'the old level-colored letter chip rules should be removed (letter now inherits the pill color)',
        );
    });

    test('each level count pill is filled with its canonical severity color', () => {
        const css = getLevelStyles();
        // The leading dot was removed; the pill is now the only colored element in the level
        // summary and the canonical palette. Its fill must match the shared severity hex (kept
        // in lockstep with .line.level-* and .level-bar-* in the line/bar style files).
        const levels: readonly [string, string][] = [
            ['error', '#f44336'],
            ['warning', '#ff9800'],
            ['info', '#2196f3'],
            ['performance', '#9c27b0'],
            ['todo', '#bdbdbd'],
            ['notice', '#00bcd4'],
            ['debug', '#795548'],
            ['database', '#4caf50'],
        ];
        for (const [level, hex] of levels) {
            // Whitespace-insensitive: the CSS aligns declarations with variable spacing.
            const pillRule = new RegExp(`\\.dot-count-${level}\\s*\\{\\s*background:\\s*${hex};`);
            assert.ok(
                pillRule.test(css),
                `count pill for ${level} should be filled with ${hex}`,
            );
        }
        // The removed dot must not leave a stray colored rule behind.
        assert.ok(!css.includes('.level-dot-error'), 'the removed leading dot color rules should be gone');
    });

    test('trouble mode dims count pills for the levels it suppresses', () => {
        const css = getLevelStyles();
        // Trouble Mode leaves .active in place, so the inactive-dimming rule cannot fire;
        // the count pills need their own trouble dim or a hidden level shows a vivid pill.
        assert.ok(
            css.includes('body.slc-trouble-active .level-dot-group[data-level="info"] .dot-count'),
            'trouble mode should dim suppressed-level count pills',
        );
    });

    test('toolbar HTML preserves required element IDs', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        const required = [
            'id="viewer-toolbar"',
            'id="toolbar-flowmap-btn"',
            'id="toolbar-filter-btn"',
            'id="toolbar-actions-btn"',
            'id="level-menu-btn"',
            'id="line-count"',
            'id="hidden-lines-counter"',
            'id="footer-selection"',
            'id="toolbar-signals-btn"',
            'id="footer-text"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `toolbar must contain ${id}`);
        }
    });

    test('toolbar HTML has data-version attribute', () => {
        const html = getToolbarHtml({ version: '4.2.0' });
        assert.ok(html.includes('data-version="v4.2.0"'), 'data-version should be set');
    });

    test('toolbar fixed elements are in toolbar-left, filename in toolbar-right', () => {
        const html = getToolbarHtml({ version: '1.0.0' });
        const leftIdx = html.indexOf('toolbar-left');
        const rightIdx = html.indexOf('toolbar-right');
        const filenameIdx = html.indexOf('toolbar-filename');
        assert.ok(leftIdx < rightIdx, 'toolbar-left should precede toolbar-right');
        assert.ok(filenameIdx > rightIdx, 'filename should be in toolbar-right');
    });

    test('filter panel HTML preserves required element IDs', () => {
        const html = getFilterDrawerHtml();
        const required = [
            'id="filters-panel"',
            'id="level-select-all"',
            'id="level-select-none"',
            'id="context-lines-slider"',
            'id="context-lines-label"',
            'name="tier-flutter"',
            'name="tier-device"',
            'id="preset-select"',
        ];
        for (const id of required) {
            assert.ok(html.includes(id), `filter panel must contain ${id}`);
        }
    });

    test('context label uses compact \u00b1N format', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('>\u00B13</span>'),
            'context label should show \u00b13 (not "Context: 3 lines")',
        );
    });

    test('syncContextSlider produces matching \u00b1N format', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-level-filter.ts');
        assert.ok(
            src.includes("'\\u00B1' + contextLinesBefore"),
            'syncContextSlider should set label to \u00b1N',
        );
    });

    test('filter drawer has tab bar with tabs', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('filter-tab-bar'),
            'filter drawer should have tab bar',
        );
        assert.ok(
            html.includes('filter-tab'),
            'tab bar should contain filter tabs',
        );
    });

    test('filter drawer has hidden preset select for backward compat', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('id="preset-select"'),
            'hidden preset select must exist for backward compat',
        );
        assert.ok(
            html.includes('>Default</option>'),
            'default preset option should read "Default"',
        );
        assert.ok(
            !html.includes('filter-drawer-footer-label'),
            'old Saved Filters footer label should be removed',
        );
    });

    test('actions dropdown has presets submenu', () => {
        const html = getActionsDropdownHtml();
        assert.ok(
            html.includes('id="presets-submenu"'),
            'actions dropdown should have presets submenu container',
        );
        assert.ok(
            html.includes('toolbar-actions-submenu-trigger'),
            'presets item should have submenu trigger class',
        );
    });

    test('filter drawer has vertical tab layout with sidebar and panels', () => {
        const html = getFilterDrawerHtml();
        assert.ok(
            html.includes('filter-tab-layout'),
            'tab bar and panels should be inside layout container',
        );
        assert.ok(
            html.includes('filter-tab-panels'),
            'tab panels should be inside panels container',
        );
    });

    test('tab switching script defines activateFilterTab', () => {
        /* Filter tab logic lives in a concatenated sibling script. */
        const tabs = readSrc('ui/viewer-toolbar/viewer-toolbar-filter-tabs-script.ts');
        const main = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(
            tabs.includes('function activateFilterTab(key)'),
            'activateFilterTab should switch visible panel',
        );
        assert.ok(
            tabs.includes('initFilterTabs'),
            'initFilterTabs should wire tab click handlers',
        );
        assert.ok(
            main.includes('getFilterTabsScript'),
            'toolbar script should concatenate the filter tabs script',
        );
    });

    test('actions dropdown preserves replay script IDs', () => {
        const html = getActionsDropdownHtml();
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

    test('content scripts load presets submenu after presets', () => {
        const src = readSrc('ui/provider/viewer-content-scripts.ts');
        const presetsIdx = src.indexOf('getPresetsScript()');
        const submenuIdx = src.indexOf('getPresetsSubmenuScript()');
        assert.ok(presetsIdx > 0, 'content scripts should load presets script');
        assert.ok(submenuIdx > 0, 'content scripts should load presets submenu script');
        assert.ok(
            submenuIdx > presetsIdx,
            'presets submenu must load after presets (depends on globals)',
        );
    });

    test('content body does not include old footer or Tags slide-out panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(!src.includes('id="footer"'), 'old footer removed');
        assert.ok(!src.includes('getFiltersPanelHtml'), 'old filters panel name removed from body');
        /* Tags sections moved into filter drawer — slide-out panel removed from body */
        assert.ok(!src.includes('getTagsPanelHtml'), 'Tags slide-out panel removed from body');
    });

    test('toolbar should be inside log-area-with-footer, not above panel-content-row', () => {
        const { getViewerBodyHtml } = require('../../ui/provider/viewer-content-body');
        const html: string = getViewerBodyHtml({ version: '1.0.0' });
        const logAreaIdx = html.indexOf('id="log-area-with-footer"');
        const toolbarIdx = html.indexOf('id="viewer-toolbar"');
        const panelSlotIdx = html.indexOf('id="panel-slot"');
        assert.ok(logAreaIdx > 0, 'log-area-with-footer must exist');
        assert.ok(toolbarIdx > logAreaIdx, 'toolbar must appear after log-area-with-footer opens');
        assert.ok(panelSlotIdx < logAreaIdx, 'panel-slot must appear before log-area-with-footer');
    });

    test('panel-content-row should be direct child of main-content with no toolbar between', () => {
        const { getViewerBodyHtml } = require('../../ui/provider/viewer-content-body');
        const html: string = getViewerBodyHtml({ version: '1.0.0' });
        const mainIdx = html.indexOf('id="main-content"');
        const panelRowIdx = html.indexOf('id="panel-content-row"');
        const toolbarIdx = html.indexOf('id="viewer-toolbar"');
        assert.ok(mainIdx < panelRowIdx, 'panel-content-row must follow main-content');
        assert.ok(toolbarIdx > panelRowIdx, 'toolbar must not appear between main-content and panel-content-row');
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
        assert.ok(
            src.includes("getElementById('viewer-toolbar')"),
            'about panel should read version from toolbar',
        );
        assert.ok(
            !src.includes("getElementById('footer-text')"),
            'about panel should not reference old footer-text for version',
        );
    });

    test('viewer-script uses toolbar element for paused state', () => {
        const src = readSrc('ui/viewer/viewer-script.ts');
        assert.ok(
            src.includes("getElementById('viewer-toolbar')"),
            'viewer-script should use toolbar for paused class toggle',
        );
    });

    test('filter badge updates toolbar icon badge', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-filter-badge.ts');
        assert.ok(
            src.includes("getElementById('toolbar-filter-count')"),
            'badge should update the toolbar filter icon badge',
        );
        assert.ok(
            !src.includes("getElementById('filter-badge')"),
            'should not reference removed standalone filter-badge',
        );
    });

    test('level filter delegates to filter drawer', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-level-filter.ts');
        assert.ok(
            src.includes('toggleFilterDrawer'),
            'toggleLevelMenu should delegate to toggleFilterDrawer',
        );
        assert.ok(
            !src.includes("getElementById('level-flyup')"),
            'should not reference removed #level-flyup element',
        );
    });

});
