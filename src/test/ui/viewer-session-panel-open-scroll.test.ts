/**
 * Pins the scroll-on-open contract added so opening the Logs side panel lands the
 * scroll position on the file currently shown in the viewer (or the top of the
 * list when nothing is loaded) instead of sitting wherever a previous open had
 * left the scrollbar — commonly the bottom, which made re-opening to switch logs
 * require scrolling back up to find the active file.
 *
 * The contract spans two files: viewer-session-panel.ts (flag + helper) and
 * viewer-session-panel-rendering.ts (consumer). Both are concatenated into the
 * same panel IIFE, so the structural assertions check the assembled script.
 */

import * as assert from 'node:assert';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';

suite('Session panel: scroll-on-open contract', () => {

    test('openSessionPanel sets pendingScrollOnOpen before requesting the list', () => {
        /* The flag must be set before requestSessionList() so the renderer that
           runs in response to the sessionList message consumes a true flag. If
           the order flips, the renderer runs with a false flag and the scroll
           does not happen. */
        const script = getSessionPanelScript();
        const open = script.indexOf('window.openSessionPanel = function()');
        const setFlag = script.indexOf('pendingScrollOnOpen = true', open);
        const request = script.indexOf('requestSessionList()', open);
        assert.ok(open !== -1, 'openSessionPanel must be defined');
        assert.ok(setFlag !== -1, 'openSessionPanel must set pendingScrollOnOpen = true');
        assert.ok(request !== -1, 'openSessionPanel must call requestSessionList()');
        assert.ok(
            setFlag < request,
            'pendingScrollOnOpen must be set BEFORE requestSessionList — otherwise the renderer consumes a false flag',
        );
    });

    test('renderSessionList consumes pendingScrollOnOpen once', () => {
        /* The consume-once shape is mandatory: the flag is set to false in the
           same statement that calls the scroll helper, so subsequent renders
           (filter toggles, pagination, refresh) leave the user's scroll alone. */
        const script = getSessionPanelScript();
        const consume = script.indexOf('if (pendingScrollOnOpen)');
        assert.ok(consume !== -1, 'renderSessionList must guard scroll on pendingScrollOnOpen');
        const reset = script.indexOf('pendingScrollOnOpen = false', consume);
        const call = script.indexOf('scrollSessionListToCurrentOrTop()', consume);
        assert.ok(reset !== -1, 'consumer must clear pendingScrollOnOpen so the scroll is one-shot');
        assert.ok(call !== -1, 'consumer must call scrollSessionListToCurrentOrTop()');
    });

    test('scrollSessionListToCurrentOrTop falls back to scrollTop = 0', () => {
        /* The fallback path covers four cases at once: no file loaded in the
           viewer, current file filtered out, current file paginated away, and
           current file in trash. All four resolve to "scroll to top" — which,
           under the default descending sort, is the newest entry. */
        const script = getSessionPanelScript();
        const helper = script.indexOf('function scrollSessionListToCurrentOrTop');
        assert.ok(helper !== -1, 'scrollSessionListToCurrentOrTop helper must be defined');
        const fallback = script.indexOf('content.scrollTop = 0', helper);
        assert.ok(fallback !== -1, 'helper must fall back to content.scrollTop = 0 when no row matches');
        const scrollInto = script.indexOf('scrollIntoView', helper);
        assert.ok(scrollInto !== -1, 'helper must scrollIntoView for the matched row');
    });

    test('getLogBasename handles both forward and backward slash separators', () => {
        /* currentFilename arrives as a forward-slash workspace-relative path; the
           data-filename on rendered rows can carry a subfolder prefix using the
           same separator. Comparison by basename keeps the match robust either way.
           In the TS template literal source, the backslash literal is written as
           the four-char sequence so the emitted JS gets a two-char escape. */
        const script = getSessionPanelScript();
        const helper = script.indexOf('function getLogBasename');
        assert.ok(helper !== -1, 'getLogBasename helper must be defined');
        const forwardSlash = script.indexOf("lastIndexOf('/')", helper);
        const backSlash = script.indexOf("lastIndexOf('\\\\')", helper);
        assert.ok(forwardSlash !== -1, 'getLogBasename must look up forward-slash separator');
        assert.ok(backSlash !== -1, 'getLogBasename must look up backslash separator (Windows paths)');
    });
});
