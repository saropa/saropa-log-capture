import * as assert from 'assert';
import { getViewerBodyHtml } from '../../ui/provider/viewer-content-body';
import { getSessionPanelHtml } from '../../ui/viewer-panels/viewer-session-panel-html';
import { getSessionTransformsScript } from '../../ui/viewer/viewer-session-transforms';
import { getSessionPanelEventsScript } from '../../ui/viewer-panels/viewer-session-panel-events';

/**
 * Pins the "every slide-out is resizable" contract.
 *
 * Before this: the resize drag handle lived inside the Session History panel markup.
 * Every panel shares the single #panel-slot grid cell and only the active panel is
 * .visible (the rest are display:none), so when SQL Query History / Bookmarks / etc.
 * was active the handle was hidden with the session panel and could not be grabbed —
 * only Sessions was resizable. The handle now lives on the persistent #panel-slot, so
 * the same slot-width drag applies to whichever panel is open.
 *
 * These assertions guard against a regression that re-nests the handle inside one panel,
 * or renames the id without updating the binder, which would silently break resize for
 * every non-session panel.
 */
suite('Panel-slot resize handle (shared across all panels)', () => {

    test('resize handle is a child of #panel-slot, before the first panel', () => {
        const html = getViewerBodyHtml({ version: '1.0.0' });
        const slotIdx = html.indexOf('id="panel-slot"');
        const handleIdx = html.indexOf('id="panel-slot-resize"');
        const sessionPanelIdx = html.indexOf('id="session-panel"');
        assert.ok(slotIdx >= 0, '#panel-slot must exist');
        assert.ok(handleIdx > slotIdx, 'resize handle must live inside #panel-slot');
        assert.ok(
            handleIdx < sessionPanelIdx,
            'handle must precede the session panel so it is a slot child, not nested in any panel',
        );
    });

    test('session panel markup no longer carries its own resize handle', () => {
        const html = getSessionPanelHtml();
        assert.ok(
            !html.includes('session-resize'),
            'old per-panel handle must be gone — a hidden session panel must not own the only handle',
        );
        assert.ok(
            !html.includes('session-panel-resize'),
            'old per-panel resize class must be gone from the session panel',
        );
    });

    test('resize binder targets the slot handle and is invoked once at startup', () => {
        const transforms = getSessionTransformsScript();
        assert.ok(
            transforms.includes("getElementById('panel-slot-resize')"),
            'initPanelSlotResize must bind the slot-level handle id',
        );
        assert.ok(
            transforms.includes('function initPanelSlotResize('),
            'binder must be named initPanelSlotResize',
        );
        const events = getSessionPanelEventsScript();
        assert.ok(
            events.includes('initPanelSlotResize('),
            'session panel script (always loaded) must invoke the binder once',
        );
    });
});
