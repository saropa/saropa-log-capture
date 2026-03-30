import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getSearchFlyoutHtml } from '../../ui/viewer-toolbar/viewer-toolbar-search-html';

/**
 * Regression tests for in-log search (now in toolbar search flyout).
 *
 * Imports only `viewer-toolbar-search-html` (no extension dependencies).
 * Script and wiring checks read `.ts` sources via `fs` so this suite runs
 * under Node/mocha without the VS Code test host.
 */
suite('Viewer toolbar search', () => {

    /** Resolve `src/` from `out/test/ui/*.js` (vscode-test) or `src/test/ui/*.ts` runners. */
    function readSrc(relFromSrc: string): string {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }

    test('viewer-content-body wires toolbar search flyout and does not use slide-out search panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(src.includes('getSearchFlyoutHtml()'), 'body should inject search flyout');
        assert.ok(
            !src.includes('getSearchPanelHtml'),
            'must not reference removed getSearchPanelHtml',
        );
    });

    test('keyboard openSearch focuses strip via openSearch, not icon bar setActivePanel', () => {
        const src = readSrc('ui/viewer/viewer-script-keyboard.ts');
        assert.ok(src.includes("action === 'openSearch'"), 'expected openSearch action branch');
        assert.ok(
            src.includes('openSearch()') && !src.includes("setActivePanel('search')"),
            'Ctrl+F should call openSearch only (search is not an icon bar panel)',
        );
    });

    test('search script targets search-flyout wrapper, not #search-bar', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        assert.ok(src.includes("getElementById('search-flyout')"), 'script should reference search-flyout DOM');
        assert.ok(
            !src.includes("getElementById('search-bar')"),
            'must not reference removed #search-bar element',
        );
    });

    test('search flyout HTML exposes stable ids for toggles and history', () => {
        const fragment = getSearchFlyoutHtml();
        const required = [
            'id="search-flyout"',
            'id="search-input"',
            'id="search-funnel-btn"',
            'id="search-options-popover"',
            'id="search-history"',
        ];
        for (const id of required) {
            assert.ok(fragment.includes(id), `expected ${id} in fragment`);
        }
        assert.ok(fragment.includes('u-hidden'), 'flyout should start hidden');
    });

    test('search history script gates Recent list on searchOpen', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search-history.ts');
        assert.ok(src.includes('!searchOpen'), 'renderSearchHistory should require active find session');
    });

    test('closeSearch clears history via blur and renderSearchHistory', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        const closeIdx = src.indexOf('function closeSearch()');
        assert.ok(closeIdx >= 0, 'expected closeSearch');
        const closeBlock = src.slice(closeIdx, closeIdx + 550);
        assert.ok(closeBlock.includes('searchInputEl.blur()'), 'closeSearch should blur input');
        assert.ok(
            closeBlock.includes('renderSearchHistory()'),
            'closeSearch should refresh history DOM so Recent list clears',
        );
    });

    test('search popovers are no-op stubs (inline in flyout now)', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search-popovers.ts');
        assert.ok(
            src.includes('function positionSearchFloatingPanels()'),
            'expected positionSearchFloatingPanels stub',
        );
        assert.ok(
            !src.includes('new IntersectionObserver'),
            'IntersectionObserver removed — popovers are inline',
        );
    });

    test('toolbar script hooks closeSearch to also close flyout', () => {
        const src = readSrc('ui/viewer-toolbar/viewer-toolbar-script.ts');
        assert.ok(
            src.includes('_origCloseSearch') && src.includes('closeSearchFlyout'),
            'toolbar script should hook closeSearch to close flyout',
        );
    });

    test('session header has no smart-sticky logic', () => {
        const src = readSrc('ui/viewer-nav/viewer-session-header.ts');
        assert.ok(
            !src.includes('setupSmartStickyHeader'),
            'smart-sticky header removed — toolbar is always visible',
        );
    });

    test('search and presets modules have no global function name collisions', () => {
        const searchSrc = readSrc('ui/viewer-search-filter/viewer-search.ts');
        const presetsSrc = readSrc('ui/viewer-search-filter/viewer-presets.ts');
        const fnPattern = /^function\s+(\w+)\s*\(/gm;
        const searchFns = new Set<string>();
        const presetsFns = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = fnPattern.exec(searchSrc)) !== null) { searchFns.add(m[1]); }
        fnPattern.lastIndex = 0;
        while ((m = fnPattern.exec(presetsSrc)) !== null) { presetsFns.add(m[1]); }
        const collisions = [...searchFns].filter(n => presetsFns.has(n));
        assert.strictEqual(
            collisions.length, 0,
            `global function name collision(s) between viewer-search and viewer-presets: ${collisions.join(', ')}`,
        );
    });

    test('clearSearchFilteredFlags exists in search script (not clearSearchFilter)', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        assert.ok(
            src.includes('function clearSearchFilteredFlags()'),
            'expected clearSearchFilteredFlags in viewer-search.ts',
        );
        assert.ok(
            !src.includes('function clearSearchFilter('),
            'clearSearchFilter must not exist — renamed to avoid presets collision',
        );
    });

    test('presetClearSearchInputValue exists in presets script (not clearSearchFilter)', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-presets.ts');
        assert.ok(
            src.includes('function presetClearSearchInputValue()'),
            'expected presetClearSearchInputValue in viewer-presets.ts',
        );
        assert.ok(
            !src.includes('function clearSearchFilter('),
            'clearSearchFilter must not exist — renamed to avoid search collision',
        );
    });
});
