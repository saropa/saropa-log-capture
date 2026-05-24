import * as assert from 'assert';
import { getProjectStatePanelHtml, getProjectStatePanelScript } from '../../ui/viewer-panels/viewer-project-state-panel';
import { getProjectStatePanelStyles } from '../../ui/viewer-styles/viewer-styles-project-state';

/**
 * Project-state panel (plan 055 Stage 3): the slide-out is host-rendered (body HTML posted via
 * `projectStateData`), so these string assertions pin the wiring that boots a webview can't easily
 * exercise — the open/close lifecycle, the data request on open, and the trusted-innerHTML injection.
 */
suite('Viewer project-state panel', () => {

    test('html exposes the container, close button, and content target', () => {
        const html = getProjectStatePanelHtml();
        assert.ok(html.includes('id="project-state-panel"'), 'panel container id present');
        assert.ok(html.includes('id="project-state-panel-close"'), 'close button id present');
        assert.ok(html.includes('id="project-state-content"'), 'content target id is what the message handler fills');
    });

    test('script opens with a data request and is mutual-exclusion friendly', () => {
        const src = getProjectStatePanelScript();
        assert.ok(src.includes('window.openProjectStatePanel'), 'open fn is window-scoped for the icon bar');
        assert.ok(src.includes('window.closeProjectStatePanel'), 'close fn is window-scoped for closeAllPanels');
        // Fresh data on every open — git state and version change between runs.
        assert.ok(src.includes("type: 'requestProjectStateData'"), 'requests data on open');
        // Close clears the icon-bar active state so the icon highlight is released.
        assert.ok(src.includes("clearActivePanel('projectState')"), 'releases the icon active state on close');
    });

    test('script injects host-built body and falls back to the passive empty state', () => {
        const src = getProjectStatePanelScript();
        assert.ok(src.includes("e.data.type !== 'projectStateData'"), 'listens for the host data message');
        // Empty body => nothing to say (passive); the script must render the empty state, not blank.
        assert.ok(src.includes("vt('viewer.projectState.empty')"), 'empty body falls back to the passive empty state');
        assert.ok(src.includes('e.data.html'), 'injects the host-built body html');
    });

    test('styles define the slide-out container and project-state rows', () => {
        const css = getProjectStatePanelStyles();
        assert.ok(css.includes('.project-state-panel'), 'container style defined');
        assert.ok(/\.project-state-panel\.visible/.test(css), 'visible toggle defined');
        for (const cls of ['.ps-row', '.ps-label', '.ps-value', '.ps-clean', '.ps-dirty', '.ps-empty']) {
            assert.ok(css.includes(cls), `${cls} style is defined`);
        }
    });
});
