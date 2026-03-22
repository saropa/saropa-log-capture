import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getSearchStyles } from '../../ui/viewer-styles/viewer-styles-search';

/** Resolve `src/` from `out/test/ui/*.js` or `src/test/ui/*.ts` (same pattern as other viewer UI tests). */
function readViewerSrc(relFromSrc: string): string {
    const fromOut = path.join(__dirname, '../../../src', relFromSrc);
    const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
    const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
    return fs.readFileSync(p, 'utf8');
}

/**
 * Static contracts for log viewer session-bar search UX and config wiring.
 * Guards progressive disclosure CSS, strict webview message handling, and icon-only session nav
 * without pulling in the VS Code extension host.
 */
suite('Viewer log search and nav contracts', () => {

    test('search CSS keeps progressive disclosure and workspace override (no false positive on “always”)', () => {
        const css = getSearchStyles();
        assert.ok(
            css.includes('.session-search-toggles-inline') && css.includes('display: none'),
            'toggles should default hidden until focus/query unless overridden',
        );
        assert.ok(
            css.includes('.session-search-input-shell:focus-within .session-search-toggles-inline'),
            'focus-within should reveal toggles',
        );
        assert.ok(
            css.includes('.session-search-compact.has-search-query .session-search-toggles-inline'),
            'non-empty query class should reveal toggles',
        );
        assert.ok(
            css.includes('body.search-match-options-always .session-search-toggles-inline'),
            'setting-driven body class should force toggles visible',
        );
        /* If “always” used loose truthiness, msg.always as string "true" could wrongly enable — source must use === true. */
        const msgSrc = readViewerSrc('ui/viewer/viewer-script-messages.ts');
        assert.ok(
            msgSrc.includes("case 'searchMatchOptionsAlwaysVisible'") && msgSrc.includes('msg.always === true'),
            'webview must toggle class only when always is strictly true',
        );
    });

    test('session log prev/next are icon-only (chevrons), not “Prev/Next” label buttons', () => {
        const body = readViewerSrc('ui/provider/viewer-content-body.ts');
        const prevIdx = body.indexOf('id="session-prev"');
        const nextIdx = body.indexOf('id="session-next"');
        assert.ok(prevIdx >= 0 && nextIdx > prevIdx, 'expected session-prev before session-next');
        const betweenPrevAndNext = body.slice(prevIdx, nextIdx);
        assert.ok(
            betweenPrevAndNext.includes('session-nav-icon-btn') && betweenPrevAndNext.includes('codicon-chevron-left'),
            'session-prev should be an icon button with chevron-left',
        );
        assert.ok(
            !betweenPrevAndNext.includes('Prev</button>') && !betweenPrevAndNext.includes('&#x25C0; Prev'),
            'session-prev must not use Prev text label (false positive if run-nav text is mistaken for session nav)',
        );
    });

    test('setupFromFindInFiles hook is injected from viewer-search-setup-from-find.ts (not main search script)', () => {
        const mainSearch = readViewerSrc('ui/viewer-search-filter/viewer-search.ts');
        assert.ok(
            !mainSearch.includes('setupFromFindInFiles'),
            'main getSearchScript must not define setupFromFindInFiles (avoids duplicate assignment / line-limit churn)',
        );
        const hook = readViewerSrc('ui/viewer-search-filter/viewer-search-setup-from-find.ts');
        assert.ok(hook.includes('window.setupFromFindInFiles'), 'hook file must assign window.setupFromFindInFiles');
        const scripts = readViewerSrc('ui/provider/viewer-content-scripts.ts');
        assert.ok(
            scripts.includes('getSearchSetupFromFindInFilesScript'),
            'viewer bundle must inject setup-from-find after search history',
        );
    });

    test('viewerAlwaysShowSearchMatchOptions is defined in package.json and parsed in config.ts', () => {
        const root = path.join(__dirname, '../../../package.json');
        const pkg = JSON.parse(fs.readFileSync(root, 'utf8')) as {
            contributes: { configuration: { properties: Record<string, { default?: unknown }> } };
        };
        const key = 'saropaLogCapture.viewerAlwaysShowSearchMatchOptions';
        const prop = pkg.contributes.configuration.properties[key];
        assert.ok(prop, `expected ${key} in package.json`);
        assert.strictEqual(prop.default, false, 'default must be false so toggles stay compact until user opts in');

        const cfgSrc = readViewerSrc('modules/config/config.ts');
        assert.ok(
            cfgSrc.includes('viewerAlwaysShowSearchMatchOptions: ensureBoolean'),
            'getConfig must map setting with ensureBoolean',
        );

        const listeners = readViewerSrc('activation-listeners.ts');
        assert.ok(
            listeners.includes('saropaLogCapture.viewerAlwaysShowSearchMatchOptions'),
            'config listener must react to this key',
        );

        const state = readViewerSrc('ui/provider/log-viewer-provider-state.ts');
        assert.ok(
            state.includes('searchMatchOptionsAlwaysVisible'),
            'provider state must post webview message type',
        );
    });
});
