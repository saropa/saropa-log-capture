import * as assert from 'assert';
import { getGitHistoryPopoverScript } from '../../ui/viewer-context-menu/viewer-git-history-popover-script';
import { getChangelogPopoverScript } from '../../ui/viewer-context-menu/viewer-changelog-popover-script';
import { getContextMenuActionsScript } from '../../ui/viewer-context-menu/viewer-context-menu-actions';
import { getContextMenuHtml } from '../../ui/viewer-context-menu/viewer-context-menu-html';

/**
 * Plan 055 Stage 2 (per-line git history) + Stage 4 (version-token changelog lookup): both render in a
 * context popover driven by a host message. The popover scripts and the menu wiring are generated TS
 * template literals, so these string assertions pin the message contract and the gating that booting a
 * webview can't cheaply exercise.
 */
suite('Viewer line git/changelog popovers', () => {

    suite('git-history popover (Stage 2)', () => {
        const src = getGitHistoryPopoverScript();
        test('exposes the handler the central popover router dispatches to', () => {
            // The git-history popover is wired via viewer-context-popover-script.ts's router, which
            // calls handleGitHistoryPopoverData on a 'gitHistoryPopoverData' message.
            assert.ok(src.includes('function handleGitHistoryPopoverData'), 'exposes the router-called handler');
            assert.ok(src.includes('function showGitHistoryPopover'), 'defines the popover renderer');
        });
        test('renders blame, recent commits, and an honest empty state', () => {
            assert.ok(src.includes("vt('viewer.gitHistory.blameLabel')"), 'blame section labelled');
            assert.ok(src.includes("vt('viewer.gitHistory.recentCommits')"), 'recent commits section labelled');
            assert.ok(src.includes("vt('viewer.gitHistory.none')"), 'empty state when no blame and no commits');
        });
        test('escapes all dynamic values (host sends raw fields, not pre-escaped html)', () => {
            assert.ok(src.includes('function ghEsc'), 'has an escape helper');
            assert.ok(/ghEsc\(b\.author\)/.test(src) && /ghEsc\(c\.message\)/.test(src), 'blame + commit fields escaped');
        });
    });

    suite('changelog-since popover (Stage 4)', () => {
        const src = getChangelogPopoverScript();
        test('registers its own listener (not via the central router) and renders three outcomes', () => {
            assert.ok(src.includes("e.data.type !== 'changelogSincePopoverData'"), 'self-contained message listener');
            // Host posts pre-rendered html, or an error string, or a "latest" message — all three handled.
            assert.ok(src.includes('msg.html'), 'renders host-built release list');
            assert.ok(src.includes('msg.error'), 'renders not-found / no-changelog errors');
            assert.ok(src.includes('msg.message'), 'renders the "latest release" message');
        });
    });

    suite('context-menu wiring', () => {
        test('menu exposes both Stage 2 and Stage 4 line actions', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="show-git-history"'), 'View Git History item present');
            assert.ok(html.includes('data-action="show-changelog-since"'), 'changelog-since item present');
        });
        test('line actions post the correct messages and share one version regex', () => {
            const src = getContextMenuActionsScript();
            assert.ok(src.includes("type: 'showGitHistoryForLine'"), 'git-history posts showGitHistoryForLine');
            assert.ok(src.includes("type: 'showChangelogSince'"), 'changelog posts showChangelogSince');
            // Single source of truth for the version token, shared with the menu gate.
            assert.ok(src.includes('var versionTokenRe ='), 'defines the shared version-token regex');
        });
    });
});
