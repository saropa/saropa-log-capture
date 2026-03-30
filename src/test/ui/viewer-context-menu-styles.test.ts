/**
 * Tests for context menu toggle CSS — verifies the checkmark span is
 * absolutely positioned so it does not push labels out of alignment
 * when toggle items are mixed with regular menu items.
 */
import * as assert from 'node:assert';
import { getContextMenuStyles } from '../../ui/viewer-styles/viewer-styles-context-menu';

suite('ViewerContextMenuStyles', () => {
    test('should position toggle checkmark absolutely to avoid flex misalignment', () => {
        const css = getContextMenuStyles();
        assert.match(
            css,
            /\.context-menu-toggle\s+\.context-menu-check\s*\{[^}]*position:\s*absolute/s,
            'context-menu-check must be position:absolute so it does not shift label text',
        );
    });

    test('should set position:relative on toggle row for absolute child', () => {
        const css = getContextMenuStyles();
        assert.match(
            css,
            /\.context-menu-toggle\s*\{[^}]*position:\s*relative/s,
            'context-menu-toggle needs position:relative as containing block for the check',
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
