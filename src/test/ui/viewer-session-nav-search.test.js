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
const viewer_search_html_1 = require("../../ui/viewer-search-filter/viewer-search-html");
/**
 * Regression tests for moving in-log search from #panel-slot into #session-nav.
 *
 * Imports only `viewer-search-html` (no extension dependencies). Script and wiring
 * checks read `.ts` sources via `fs` so this suite runs under Node/mocha without
 * the VS Code test host (`vscode` module).
 */
suite('Viewer session nav search', () => {
    /** Resolve `src/` from `out/test/ui/*.js` (vscode-test) or `src/test/ui/*.ts` runners. */
    function readSrc(relFromSrc) {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }
    test('viewer-content-body wires session-nav search and does not use slide-out search panel', () => {
        const src = readSrc('ui/provider/viewer-content-body.ts');
        assert.ok(src.includes('getSessionNavSearchHtml()'), 'body should inject compact search');
        assert.ok(!src.includes('getSearchPanelHtml'), 'must not reference removed getSearchPanelHtml (false positive if reintroduced)');
        const iNav = src.indexOf('id="session-nav"');
        const iSearchCall = src.indexOf('${getSessionNavSearchHtml()}');
        assert.ok(iNav >= 0 && iSearchCall > iNav, 'search injection should follow session-nav open');
    });
    test('composed markup orders session nav search before panel-slot and excludes duplicate in slot', () => {
        const panelSlotInner = '<div id="session-panel"></div>';
        const fakeBody = `<div id="session-nav"><span class="session-nav-controls"></span>${(0, viewer_search_html_1.getSessionNavSearchHtml)()}</div>`
            + `<div id="panel-slot">${panelSlotInner}</div><div id="log-area-with-footer">`;
        const iNav = fakeBody.indexOf('id="session-nav"');
        const iSearch = fakeBody.indexOf('id="session-nav-search-outer"');
        const iSlot = fakeBody.indexOf('id="panel-slot"');
        assert.ok(iNav < iSearch && iSearch < iSlot, 'search outer should sit between nav open and panel-slot');
        const slotSlice = fakeBody.slice(iSlot, fakeBody.indexOf('id="log-area-with-footer"'));
        assert.ok(!slotSlice.includes('id="session-nav-search-outer"'), 'panel-slot slice must not contain compact search (duplication false positive)');
    });
    test('keyboard openSearch focuses strip via openSearch, not icon bar setActivePanel', () => {
        const src = readSrc('ui/viewer/viewer-script-keyboard.ts');
        assert.ok(src.includes("action === 'openSearch'"), 'expected openSearch action branch');
        assert.ok(src.includes('openSearch()') && !src.includes("setActivePanel('search')"), 'Ctrl+F should call openSearch only (search is not an icon bar panel)');
    });
    test('search script targets session nav outer wrapper, not #search-bar', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        assert.ok(src.includes('session-nav-search-outer'), 'script should reference session nav search DOM');
        assert.ok(!src.includes("getElementById('search-bar')"), 'must not reference removed #search-bar element');
    });
    test('session nav search HTML exposes stable ids for toggles and history', () => {
        const fragment = (0, viewer_search_html_1.getSessionNavSearchHtml)();
        const required = [
            'id="search-input"',
            'session-search-toggles-inline',
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
    test('search history script gates Recent list on searchOpen (fixed panel dismissible)', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search-history.ts');
        assert.ok(src.includes('!searchOpen'), 'renderSearchHistory should require active find session');
        assert.ok(src.includes('Only show while the find session is open'), 'expected rationale comment for searchOpen gate');
    });
    test('closeSearch clears fixed history via blur and renderSearchHistory', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search.ts');
        const closeIdx = src.indexOf('function closeSearch()');
        assert.ok(closeIdx >= 0, 'expected closeSearch');
        const closeBlock = src.slice(closeIdx, closeIdx + 550);
        assert.ok(closeBlock.includes('searchInputEl.blur()'), 'closeSearch should blur input');
        assert.ok(closeBlock.includes('renderSearchHistory()'), 'closeSearch should refresh history DOM so Recent list clears');
    });
    test('search popovers use IntersectionObserver for fixed history when shell off-screen', () => {
        const src = readSrc('ui/viewer-search-filter/viewer-search-popovers.ts');
        assert.ok(src.includes('IntersectionObserver'), 'expected IO for history visibility');
        assert.ok(src.includes('setupSearchShellIntersection'), 'expected named setup IIFE');
        assert.ok(src.includes('hist.style.visibility') && src.includes('pointerEvents'), 'expected visibility/pointer-events when hiding fixed history');
    });
    test('smart sticky header syncs positionSearchFloatingPanels after header class toggle', () => {
        const src = readSrc('ui/viewer-nav/viewer-session-header.ts');
        assert.ok(src.includes('positionSearchFloatingPanels') && src.includes('smart-header-hidden'), 'expected scroll handler to sync floating search UI after smart header toggle');
    });
});
//# sourceMappingURL=viewer-session-nav-search.test.js.map