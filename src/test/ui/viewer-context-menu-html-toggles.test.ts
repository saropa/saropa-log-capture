import * as assert from 'node:assert';
import { getContextMenuHtml, getScrollChromeContextMenuHtml } from '../../ui/viewer-context-menu/viewer-context-menu';

suite('ViewerContextMenuHtml', () => {
    suite('getContextMenuHtml', () => {
        test('should include toggle structure for Layout items', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('context-menu-toggle'));
            assert.ok(html.includes('context-menu-check'));
            assert.ok(html.includes('codicon-check'));
        });

        test('should use context-menu-label class on all toggle text spans in main menu', () => {
            const html = getContextMenuHtml();
            /* Only toggles in the main menu — minimap/scrollbar toggles live in the compact
               scroll-chrome menu (getScrollChromeContextMenuHtml) and are not in getContextMenuHtml. */
            const toggleActions = [
                'toggle-wrap', 'toggle-line-numbers', 'toggle-timestamp',
                'toggle-session-elapsed', 'toggle-parsed-tag',
                'toggle-spacing', 'toggle-line-height',
                'toggle-compress-lines', 'toggle-compress-lines-global',
                'toggle-show-blank-lines',
            ];
            for (const action of toggleActions) {
                const pattern = new RegExp(
                    `data-action="${action}"[\\s\\S]{0,300}class="context-menu-label"`,
                );
                assert.ok(
                    pattern.test(html),
                    `toggle ${action} should have context-menu-label on its text span`,
                );
            }
        });
        test('should have title tooltip on every context-menu-item', () => {
            const html = getContextMenuHtml();
            /* Every data-action item must carry a title attribute for tooltip.
               Extract each <div ...data-action="X"...> opening tag and check for title=. */
            const divPattern = /<div[^>]+data-action="([^"]+)"[^>]*>/g;
            let match;
            const missingTooltips: string[] = [];
            while ((match = divPattern.exec(html)) !== null) {
                const action = match[1];
                const tag = match[0];
                if (!tag.includes('title="')) {
                    missingTooltips.push(action);
                }
            }
            assert.deepStrictEqual(
                missingTooltips, [],
                `menu items missing title tooltip: ${missingTooltips.join(', ')}`,
            );
        });

        test('should use "View" not "Show" for navigation actions to avoid confusion with toggles', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('View Context'));
            assert.ok(html.includes('View Integration Context'));
            assert.ok(html.includes('View Related Queries'));
            assert.ok(html.includes('View Code Quality'));
            /* "Show" should not appear as the visible label for these navigation items. */
            assert.ok(!html.includes('>Show Context<') && !html.includes('> Show Context<'));
            assert.ok(!html.includes('>Show code quality<') && !html.includes('> Show code quality<'));
        });

        test('should show keyboard shortcut hints on items that have bindings', () => {
            const html = getContextMenuHtml();
            /* Each shortcut hint uses context-menu-shortcut class with the key text.
               Verify by finding the action, then checking the shortcut span follows. */
            const expected: [string, string][] = [
                ['copy-json', 'Ctrl+C'],
                ['copy-all', 'Ctrl+Shift+A'],
                ['select-all', 'Ctrl+A'],
                ['pin', 'P'],
                ['bookmark', 'Ctrl+B'],
                ['toggle-wrap', 'W'],
                ['toggle-spacing', 'V'],
                ['toggle-line-height', 'Ctrl+Shift+Scroll'],
                ['toggle-compress-lines', 'C'],
                ['toggle-show-blank-lines', 'H'],
            ];
            for (const [action, key] of expected) {
                const actionIdx = html.indexOf(`data-action="${action}"`);
                assert.ok(actionIdx >= 0, `${action} must exist in HTML`);
                /* Find the shortcut span within the same menu item (next 500 chars). */
                const slice = html.slice(actionIdx, actionIdx + 500);
                assert.ok(
                    slice.includes(`context-menu-shortcut">${key}<`),
                    `${action} should show shortcut hint "${key}"`,
                );
            }
        });

        test('should use positive "Show blank lines" label with inverted toggle logic', () => {
            const html = getContextMenuHtml();
            assert.ok(html.includes('data-action="toggle-show-blank-lines"'));
            assert.ok(html.includes('Show blank lines'));
            /* Old negative "Hide blank lines" label must not appear as a toggle label. */
            assert.ok(!html.includes('"toggle-hide-blank-lines"'));
        });
    });

    suite('getScrollChromeContextMenuHtml', () => {
        test('should expose the same toggles as the Scroll map submenu (minimap / scrollbar right-click)', () => {
            const html = getScrollChromeContextMenuHtml();
            assert.ok(html.includes('id="scroll-chrome-context-menu"'));
            assert.ok(html.includes('data-action="toggle-minimap-proportional"'));
            assert.ok(html.includes('data-action="toggle-show-scrollbar"'));
        });

        test('should include title attributes on scroll-chrome toggle items', () => {
            const html = getScrollChromeContextMenuHtml();
            assert.ok(html.includes('title="Proportional line width (minimap)"'));
            assert.ok(html.includes('title="Show native scrollbar"'));
            assert.ok(html.includes('title="Info / debug / notice on minimap"'));
            assert.ok(html.includes('title="SQL density on minimap"'));
            assert.ok(html.includes('title="Red outline on viewport"'));
            assert.ok(html.includes('title="Yellow arrow outside minimap"'));
        });
    });
});
