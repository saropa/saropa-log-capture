/**
 * Tests for the Logs panel kebab options menu after it was regrouped into flyout submenus
 * (Filter / Display / Actions) so the menu fits short panels, with a viewport-aware positioner
 * so the flyouts are never cropped.
 *
 * Guards two things a future edit could silently break: (1) the grouping markup + that every
 * interactive control kept its id (all wiring is by id), and (2) the no-crop positioner exists
 * and runs against the live viewport.
 */
import * as assert from 'assert';
import { getSessionPanelHtml } from '../../ui/viewer-panels/viewer-session-panel-html';
import { getSessionOptionsMenuScript } from '../../ui/viewer-panels/viewer-session-options-menu';

suite('Session options menu (grouped submenus)', () => {
    suite('getSessionPanelHtml — grouping', () => {
        const html = getSessionPanelHtml();

        test('should group options into three submenu flyouts', () => {
            /* Reuses the shared .context-menu-submenu flyout pattern; .session-options-submenu is the
               JS hook for the positioner. Three groups: Filter, Display, Actions. */
            const groups = (html.match(/session-options-submenu"/g) ?? []).length;
            assert.strictEqual(groups, 3, 'Filter, Display, and Actions should each be a submenu');
            assert.ok(html.includes('context-menu-submenu-content'), 'submenus use the shared flyout panel');
        });

        test('should keep every interactive control id (all wiring is by id)', () => {
            for (const id of [
                'session-date-range', 'session-size-range',
                'session-toggle-strip', 'session-toggle-normalize', 'session-toggle-headings',
                'session-toggle-reverse', 'session-toggle-latest', 'session-filter-tags',
                'session-export-list', 'session-open-file',
            ]) {
                assert.ok(html.includes(`id="${id}"`), `${id} must survive the regrouping`);
            }
        });

        test('should place the Tags filter inside the Filter submenu (it is a filter)', () => {
            /* Tags moved into the Filter group so the top level is a clean Filter/Display/Actions and
               no stray toggle pill sits among the submenu arrows. The Filter flyout's inner markup is
               inlined before the Display group, so the tags toggle must fall between the two group
               labels in document order. */
            const tagsIdx = html.indexOf('id="session-filter-tags"');
            const filterGroupIdx = html.indexOf('id="session-filter-group"');
            // First control of the Display group marks where the Filter group's inner markup ends.
            const displayStartIdx = html.indexOf('id="session-toggle-strip"');
            assert.ok(tagsIdx > 0 && filterGroupIdx > 0 && displayStartIdx > 0, 'tags toggle + both groups present');
            assert.ok(tagsIdx > filterGroupIdx && tagsIdx < displayStartIdx, 'tags lives inside the Filter group');
        });

        test('should give the Filter group an active-filter indicator dot', () => {
            assert.ok(html.includes('id="session-filter-group"'), 'Filter group is targetable for the dot toggle');
            assert.ok(html.includes('session-options-filter-dot'), 'Filter group carries the indicator dot element');
        });
    });

    suite('getSessionOptionsMenuScript — no-crop positioner', () => {
        const script = getSessionOptionsMenuScript();

        test('should position flyouts against the live viewport so they are never cropped', () => {
            assert.ok(script.includes('positionSessionOptionsSubmenu'), 'positioner must exist');
            assert.ok(script.includes("style.position = 'fixed'"), 'flyout is placed in viewport coordinates');
            assert.ok(script.includes('window.innerWidth') && script.includes('window.innerHeight'),
                'placement clamps to the viewport');
            assert.ok(script.includes('maxHeight'), 'a flyout taller than the viewport scrolls instead of clipping');
        });

        test('should reveal each submenu on hover and keyboard focus', () => {
            assert.ok(script.includes("addEventListener('mouseenter'"), 'hover reveals the flyout');
            assert.ok(script.includes("addEventListener('focusin'"), 'keyboard focus reveals the flyout');
        });
    });

    /* The kebab menu ends with a "recently opened files" shortcut list under its last separator:
       a list container, a dim empty-state notice, and (in the script) the render + open-on-click
       wiring. These guard the markup the runtime renderer targets by id and the open path it posts. */
    suite('recently-opened files section', () => {
        const html = getSessionPanelHtml();
        const script = getSessionOptionsMenuScript();

        test('should render the empty notice and list container after the Actions group', () => {
            assert.ok(html.includes('id="session-loaded-files-empty"'), 'empty-notice element is present for the renderer to toggle');
            assert.ok(html.includes('id="session-loaded-files-list"'), 'list container is present for the renderer to fill');
            assert.ok(html.includes('Opened files will appear here'), 'dim empty-state notice text is present');
            // The list must follow the Actions submenu's last action (Open log from URL) in document order.
            assert.ok(
                html.indexOf('id="session-loaded-files-list"') > html.indexOf('id="session-open-url"'),
                'the shortcut list renders after the Actions submenu',
            );
        });

        test('should not add a fourth submenu flyout (the list is a plain section, not a group)', () => {
            /* Guards the sibling grouping test: the new section uses .session-loaded-files, NOT
               .session-options-submenu, so the Filter/Display/Actions count stays exactly three. */
            const groups = (html.match(/session-options-submenu"/g) ?? []).length;
            assert.strictEqual(groups, 3, 'recently-opened list must not register as a submenu group');
        });

        test('should wire the render + open-on-click behavior in the menu script', () => {
            assert.ok(script.includes('renderLoadedFilesMenu'), 'render function exists');
            assert.ok(script.includes('loadedManually'), 'filters to manually-loaded records only');
            assert.ok(script.includes('slice(0, 10)'), 'caps the list at the 10 most recent');
            assert.ok(script.includes('openSessionFromPanel'), 'a row click re-opens via the shared openSessionFromPanel path');
        });
    });
});
