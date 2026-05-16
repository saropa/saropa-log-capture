/**
 * Pins the mutual-exclusion guard that prevents two slide-out panels from being .visible
 * simultaneously inside #panel-slot's single-cell CSS grid (see viewer-styles.ts:122-136).
 *
 * Before this guard: any code path that bypassed setActivePanel() — the host's openSignalPanel
 * postMessage, the toolbar Performance chip, and similar entry points — could leave a previously
 * .visible panel (commonly Sessions/Logs) still .visible, and its content would bleed through
 * the newly-shown Signal panel as overlapping text.
 */

import * as assert from 'node:assert';
import { getIconBarScript } from '../../ui/viewer-nav/viewer-icon-bar';
import { getSignalScriptPartA } from '../../ui/panels/viewer-signal-panel-script-part-a';
import { getSessionPanelScript } from '../../ui/viewer-panels/viewer-session-panel';

suite('Panel-slot mutual exclusion (#panel-slot grid stack)', () => {

    test('icon-bar exposes hideOtherPanelsInSlot helper on window', () => {
        const script = getIconBarScript();
        assert.ok(
            script.includes('window.hideOtherPanelsInSlot = function(except)'),
            'helper must be window-scoped so panel scripts in other files can call it',
        );
        /* The helper must skip the panel that is about to be shown, otherwise it would strip
           the caller's own .visible immediately after they add it. */
        assert.ok(
            script.includes('if (n === except) continue;'),
            'helper must skip the except element so the caller does not erase its own visibility',
        );
    });

    test('openSignalPanel hides peer panels before adding its own .visible', () => {
        const script = getSignalScriptPartA('test-key', '{}');
        const open = script.indexOf('window.openSignalPanel = function()');
        const visibleAdd = script.indexOf("signalPanel.classList.add('visible')", open);
        const hideCall = script.indexOf('hideOtherPanelsInSlot(signalPanel)', open);
        assert.ok(open !== -1, 'openSignalPanel must be defined');
        assert.ok(hideCall !== -1, 'openSignalPanel must call hideOtherPanelsInSlot');
        assert.ok(visibleAdd !== -1, 'openSignalPanel must add .visible to signal panel');
        assert.ok(
            hideCall < visibleAdd,
            'hideOtherPanelsInSlot must run BEFORE adding .visible — otherwise the helper would strip it',
        );
    });

    test('openSessionPanel hides peer panels before adding its own .visible', () => {
        const script = getSessionPanelScript();
        const open = script.indexOf('window.openSessionPanel = function()');
        const visibleAdd = script.indexOf("sessionPanelEl.classList.add('visible')", open);
        const hideCall = script.indexOf('hideOtherPanelsInSlot(sessionPanelEl)', open);
        assert.ok(open !== -1, 'openSessionPanel must be defined');
        assert.ok(hideCall !== -1, 'openSessionPanel must call hideOtherPanelsInSlot');
        assert.ok(visibleAdd !== -1, 'openSessionPanel must add .visible to session panel');
        assert.ok(
            hideCall < visibleAdd,
            'hideOtherPanelsInSlot must run BEFORE adding .visible',
        );
    });
});
