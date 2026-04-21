import * as assert from 'assert';
import { getSessionContextMenuHtml, getSessionContextMenuScript } from '../../ui/viewer-context-menu/viewer-session-context-menu';

suite('ViewerSessionContextMenu', () => {
    suite('getSessionContextMenuHtml', () => {
        test('should include Replay action', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="replay"'));
            assert.ok(html.includes('Replay'));
        });
        test('should include Open and other session actions', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="open"'));
            assert.ok(html.includes('data-session-action="trash"'));
        });
        test('should include Hide This Name action', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="hideByName"'));
            assert.ok(html.includes('Hide This Name'));
            assert.ok(html.includes('codicon-eye-closed'));
        });
        test('should include Show Only This Name action', () => {
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="showOnlyByName"'));
            assert.ok(html.includes('Show Only This Name'));
            assert.ok(html.includes('codicon-eye'));
        });
        test('should mark name filter actions as session-normal-only', () => {
            /* Name filter items should be hidden for trashed sessions. */
            const html = getSessionContextMenuHtml();
            const hideIdx = html.indexOf('hideByName');
            const showIdx = html.indexOf('showOnlyByName');
            assert.ok(hideIdx > 0);
            assert.ok(showIdx > 0);
            /* Both should be inside elements with session-normal-only class. */
            const hideItem = html.lastIndexOf('session-normal-only', hideIdx);
            const showItem = html.lastIndexOf('session-normal-only', showIdx);
            assert.ok(hideItem > 0, 'hideByName should have session-normal-only');
            assert.ok(showItem > 0, 'showOnlyByName should have session-normal-only');
        });
        test('should include Reveal in File Explorer action with folder-opened icon', () => {
            /* The reveal action lets the user jump from a log row to its OS folder.
               It must be exposed both on the hover button (tested in panel runtime)
               and on the context menu for keyboard/multi-select users. */
            const html = getSessionContextMenuHtml();
            assert.ok(html.includes('data-session-action="revealInOS"'));
            assert.ok(html.includes('codicon-folder-opened'));
            assert.ok(html.includes('session-reveal-label'));
        });
        test('should group the 6 export actions under an Export flyout submenu', () => {
            /* Export targets HTML, CSV, JSON, JSONL, .slc Bundle, and Loki live in a
               flyout submenu to keep the top-level menu short. Each action must still
               be present with its data-session-action intact so the extension handler
               keeps working unchanged. */
            const html = getSessionContextMenuHtml();
            const submenuIdx = html.indexOf('id="session-export-submenu"');
            assert.ok(submenuIdx > 0, 'Export submenu trigger should exist');
            const submenuOpen = html.indexOf('context-menu-submenu-content', submenuIdx);
            const submenuEnd = html.indexOf('</div>\n        </div>', submenuOpen);
            const submenuBlock = html.slice(submenuOpen, submenuEnd);
            const exportActions = [
                'exportHtml', 'exportCsv', 'exportJson', 'exportJsonl', 'exportSlc', 'exportToLoki',
            ];
            for (const action of exportActions) {
                assert.ok(
                    submenuBlock.includes(`data-session-action="${action}"`),
                    `Export submenu should contain ${action}`,
                );
            }
            assert.ok(html.includes('codicon-chevron-right'), 'Submenu should show chevron arrow');
        });
        test('should group the 2 copy actions under a Copy flyout submenu', () => {
            /* Copy Deep Link and Copy File Path live in their own flyout submenu.
               The Copy submenu must sit after the Export submenu in document order
               and contain both copy actions. */
            const html = getSessionContextMenuHtml();
            const submenuIdx = html.indexOf('id="session-copy-submenu"');
            assert.ok(submenuIdx > 0, 'Copy submenu trigger should exist');
            const submenuOpen = html.indexOf('context-menu-submenu-content', submenuIdx);
            const submenuEnd = html.indexOf('</div>\n        </div>', submenuOpen);
            const submenuBlock = html.slice(submenuOpen, submenuEnd);
            assert.ok(
                submenuBlock.includes('data-session-action="copyDeepLink"'),
                'Copy submenu should contain copyDeepLink',
            );
            assert.ok(
                submenuBlock.includes('data-session-action="copyFilePath"'),
                'Copy submenu should contain copyFilePath',
            );
            /* Label spans let the pluralization JS update text without clobbering the codicon. */
            assert.ok(html.includes('session-copy-deep-link-label'));
            assert.ok(html.includes('session-copy-file-path-label'));
        });
    });
    suite('getSessionContextMenuScript', () => {
        test('should post sessionAction with action and uriStrings/filenames', () => {
            const script = getSessionContextMenuScript();
            assert.ok(script.includes('sessionAction'));
            assert.ok(script.includes('sessionCtxUris'));
            assert.ok(script.includes('uriStrings'));
            assert.ok(script.includes('filenames'));
        });
        test('should handle hideByName locally without posting to extension', () => {
            /* The script should intercept hideByName and call setSessionNameFilter
               instead of posting a sessionAction message to the extension. */
            const script = getSessionContextMenuScript();
            assert.ok(script.includes("action === 'hideByName'"));
            assert.ok(script.includes('setSessionNameFilter'));
        });
        test('should handle showOnlyByName locally without posting to extension', () => {
            const script = getSessionContextMenuScript();
            assert.ok(script.includes("action === 'showOnlyByName'"));
            /* Both name filter actions early-return before postMessage. */
            assert.ok(script.includes("return;"), 'Name filter actions should return early');
        });
        test('should look up session from cachedSessions for name filter', () => {
            /* Context menu should use cachedSessions to get displayName, not just
               the data-filename attribute, so renamed sessions match correctly. */
            const script = getSessionContextMenuScript();
            assert.ok(script.includes('cachedSessions'));
            assert.ok(script.includes('displayName'));
        });
        test('should expose platform-aware reveal label on window', () => {
            /* The hover button in session rows reuses getRevealInOSLabel so the
               tooltip matches the context menu label (Explorer/Finder/Containing Folder). */
            const script = getSessionContextMenuScript();
            assert.ok(script.includes('window.getRevealInOSLabel'));
            assert.ok(script.includes('Reveal in Finder'));
            assert.ok(script.includes('Open Containing Folder'));
            assert.ok(script.includes('Reveal in File Explorer'));
        });
        test('should pluralize Copy submenu labels via label spans when multi-selected', () => {
            /* The new flyout layout wraps each copy label in its own span, so the script
               must target those spans (not the menu item's lastChild) when toggling between
               singular and plural forms for multi-select. */
            const script = getSessionContextMenuScript();
            assert.ok(script.includes('.session-copy-deep-link-label'));
            assert.ok(script.includes('.session-copy-file-path-label'));
            assert.ok(script.includes('Copy Deep Links'));
            assert.ok(script.includes('Copy File Paths'));
        });
        test('should toggle flip-submenu class when near right viewport edge', () => {
            /* When the session menu opens near the right edge, the Export/Copy flyout panels
               would overflow off-screen. The script flips them to open leftward by adding the
               flip-submenu class, mirroring the line context menu pattern. */
            const script = getSessionContextMenuScript();
            assert.ok(script.includes("classList.toggle('flip-submenu'"));
        });
    });
});
