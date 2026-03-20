import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getSessionNavSearchHtml } from '../../ui/viewer-search-filter/viewer-search-html';

/**
 * Regression tests for moving in-log search from #panel-slot into #session-nav.
 *
 * Imports only `viewer-search-html` (no extension dependencies). Script and wiring
 * checks read `.ts` sources via `fs` so this suite runs under Node/mocha without
 * the VS Code test host (`vscode` module).
 */
suite('Viewer session nav search', () => {

    /** Resolve `src/` from `out/test/ui/*.js` (vscode-test) or `src/test/ui/*.ts` runners. */
    function readSrc(relFromSrc: string): string {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }

    test('viewer-content-body wires session-nav search and does not use slide-out search panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(src.includes('getSessionNavSearchHtml()'), 'body should inject compact search');
        assert.ok(
            !src.includes('getSearchPanelHtml'),
            'must not reference removed getSearchPanelHtml (false positive if reintroduced)',
        );
        const iNav = src.indexOf('id="session-nav"');
        const iSearchCall = src.indexOf('${getSessionNavSearchHtml()}');
        assert.ok(iNav >= 0 && iSearchCall > iNav, 'search injection should follow session-nav open');
    });

    test('composed markup orders session nav search before panel-slot and excludes duplicate in slot', () => {
        const panelSlotInner = '<div id="session-panel"></div>';
        const fakeBody =
            `<div id="session-nav"><span class="session-nav-controls"></span>${getSessionNavSearchHtml()}</div>`
            + `<div id="panel-slot">${panelSlotInner}</div><div id="log-area-with-footer">`;

        const iNav = fakeBody.indexOf('id="session-nav"');
        const iSearch = fakeBody.indexOf('id="session-nav-search-outer"');
        const iSlot = fakeBody.indexOf('id="panel-slot"');
        assert.ok(iNav < iSearch && iSearch < iSlot, 'search outer should sit between nav open and panel-slot');

        const slotSlice = fakeBody.slice(iSlot, fakeBody.indexOf('id="log-area-with-footer"'));
        assert.ok(
            !slotSlice.includes('id="session-nav-search-outer"'),
            'panel-slot slice must not contain compact search (duplication false positive)',
        );
    });

    test('icon bar script skips panel width animation for active search tool', () => {
        const src = readSrc('ui/viewer-nav/viewer-icon-bar.ts');
        assert.ok(src.includes("name === 'search'"), 'updatePanelSlotWidth should special-case search');
        const fnStart = src.indexOf('function updatePanelSlotWidth');
        assert.ok(fnStart >= 0, 'expected updatePanelSlotWidth');
        const fnEnd = src.indexOf('window.setPanelSlotWidth', fnStart);
        assert.ok(fnEnd > fnStart, 'expected setPanelSlotWidth after updatePanelSlotWidth');
        const searchInFn = src.indexOf("name === 'search'", fnStart);
        assert.ok(searchInFn >= fnStart && searchInFn < fnEnd, 'search case must be inside updatePanelSlotWidth only');
    });

    test('search script targets session nav outer wrapper, not #search-bar', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        assert.ok(src.includes('session-nav-search-outer'), 'script should reference session nav search DOM');
        assert.ok(
            !src.includes("getElementById('search-bar')"),
            'must not reference removed #search-bar element',
        );
    });

    test('session nav search HTML exposes stable ids for toggles and history', () => {
        const fragment = getSessionNavSearchHtml();
        const required = [
            'id="search-input"',
            'id="search-funnel-btn"',
            'id="search-options-popover"',
            'id="search-case-toggle"',
            'id="search-word-toggle"',
            'id="search-regex-toggle"',
            'id="search-mode-toggle"',
            'id="search-history"',
        ];
        for (const id of required) {
            assert.ok(fragment.includes(id), `expected ${id} in fragment`);
        }
        assert.ok(fragment.includes('hidden'), 'options popover should start hidden');
    });
});
