/**
 * Tests for context menu toggle CSS — verifies the checkmark span is
 * inline in the flex flow (between icon and label) so it cannot be
 * mistaken for a submenu arrow on the right edge.
 */
import * as assert from 'node:assert';
import { getContextMenuStyles } from '../../ui/viewer-styles/viewer-styles-context-menu';

suite('ViewerContextMenuStyles', () => {
    test('should NOT position toggle checkmark absolutely (prevents submenu-arrow confusion)', () => {
        const css = getContextMenuStyles();
        /* The check sits inline between icon and label. Absolute positioning at
           right:8px made it look like a submenu ▸ indicator. */
        const checkBlock = css.match(/\.context-menu-toggle\s+\.context-menu-check\s*\{([^}]*)\}/s);
        assert.ok(checkBlock, 'context-menu-check rule must exist');
        assert.ok(
            !checkBlock[1].includes('position'),
            'context-menu-check must NOT have position:absolute — it flows inline in the flex row',
        );
    });

    test('should set position:relative on toggle row for children', () => {
        const css = getContextMenuStyles();
        assert.match(
            css,
            /\.context-menu-toggle\s*\{[^}]*position:\s*relative/s,
            'context-menu-toggle keeps position:relative for potential absolute-positioned overlays',
        );
    });

    test('should hide checkmark by default and show when checked', () => {
        const css = getContextMenuStyles();
        assert.match(
            css,
            /\.context-menu-toggle\s+\.context-menu-check\s*\{[^}]*opacity:\s*0/s,
            'checkmark should be hidden (opacity 0) by default',
        );
        assert.match(
            css,
            /\.context-menu-toggle\.checked\s+\.context-menu-check\s*\{[^}]*opacity:\s*0\.8/s,
            'checkmark should become visible (opacity 0.8) when row has .checked',
        );
    });
});
