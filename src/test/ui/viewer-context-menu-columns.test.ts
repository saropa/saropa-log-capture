/**
 * Columns submenu tests, extracted from viewer-context-menu-html.test.ts to
 * keep both files under the 300-line max-lines lint cap.
 *
 * The Columns submenu owns the per-line column toggles (line numbers,
 * timestamp, session elapsed, parsed tag). It must appear ABOVE the Layout
 * submenu in the markup so the user sees column controls first — Layout is
 * for whole-row treatment (wrap, spacing, line height, compression).
 */
import * as assert from 'node:assert';
import { getContextMenuHtml, getContextMenuScript } from '../../ui/viewer-context-menu/viewer-context-menu';

suite('ViewerContextMenuColumns', () => {
    test('should expose the Columns submenu with the table codicon and a Tag toggle', () => {
        const html = getContextMenuHtml();
        assert.ok(html.includes('> Columns\n'));
        assert.ok(
            html.includes('codicon-table"></span> Columns'),
            'Columns submenu uses the table codicon',
        );
        assert.ok(html.includes('data-action="toggle-line-numbers"'));
        assert.ok(html.includes('data-action="toggle-timestamp"'));
        assert.ok(html.includes('data-action="toggle-session-elapsed"'));
        assert.ok(html.includes('data-action="toggle-parsed-tag"'));
        assert.ok(html.includes('Line numbers'));
        assert.ok(html.includes('Timestamp'));
        assert.ok(html.includes('Session elapsed'));
        assert.ok(
            /data-action="toggle-parsed-tag"[\s\S]{0,300}>Tag</.test(html),
            'Tag toggle must use the label "Tag"',
        );
    });

    test('Columns toggles render in fixed order: line numbers → timestamp → session elapsed → tag', () => {
        const html = getContextMenuHtml();
        const lnIdx = html.indexOf('data-action="toggle-line-numbers"');
        const tsIdx = html.indexOf('data-action="toggle-timestamp"');
        const seIdx = html.indexOf('data-action="toggle-session-elapsed"');
        const tagIdx = html.indexOf('data-action="toggle-parsed-tag"');
        assert.ok(
            lnIdx > 0 && tsIdx > lnIdx && seIdx > tsIdx && tagIdx > seIdx,
            'Columns toggles must appear in order: line numbers → timestamp → session elapsed → tag',
        );
    });

    test('Columns submenu must precede Layout in the markup', () => {
        const html = getContextMenuHtml();
        const columnsIdx = html.indexOf('> Columns');
        const layoutIdx = html.indexOf('> Layout');
        assert.ok(
            columnsIdx > 0 && layoutIdx > columnsIdx,
            'Columns submenu must appear before Layout so it renders above it',
        );
    });

    test('Layout submenu must NOT contain column toggles (they live in Columns)', () => {
        const html = getContextMenuHtml();
        const layoutIdx = html.indexOf('> Layout\n');
        assert.ok(layoutIdx >= 0);
        const layoutBlock = html.slice(layoutIdx, html.indexOf('</div>\n</div>', layoutIdx));
        assert.ok(!layoutBlock.includes('toggle-line-numbers'));
        assert.ok(!layoutBlock.includes('toggle-timestamp'));
        assert.ok(!layoutBlock.includes('toggle-session-elapsed'));
        assert.ok(!layoutBlock.includes('toggle-parsed-tag'));
    });

    test('parsed-tag toggle is wired into the dispatcher and the checkmark sync', () => {
        const script = getContextMenuScript();
        /* Dispatcher: handleToggleAction must route 'toggle-parsed-tag' to toggleParsedTag(). */
        assert.ok(
            script.includes("'toggle-parsed-tag': typeof toggleParsedTag === 'function'"),
            'handleToggleAction must dispatch toggle-parsed-tag to toggleParsedTag()',
        );
        /* Checkmark sync: syncContextMenuToggles must read decoShowParsedTag.
           The default-on shape (undefined → on) keeps the check visible before
           viewer-deco-settings.ts script has executed. */
        assert.ok(
            /toggle-parsed-tag[\s\S]{0,200}decoShowParsedTag/.test(script),
            'syncContextMenuToggles must reflect decoShowParsedTag on the toggle-parsed-tag item',
        );
    });
});
