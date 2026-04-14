/**
 * Tests for continuation badge rendering in `renderItem` (embedded webview script).
 *
 * Verifies that the continuation collapse/expand badge:
 * - Shows only `[+]` / `[−]` as visible text (no inline count)
 * - Includes the line count in the tooltip only
 * - Is positioned inline next to the decoration prefix, not at the end of the line
 * - Uses the `.cont-badge` class for click handling
 */
import * as assert from 'node:assert';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getDecorationBarStyles } from '../../ui/viewer-styles/viewer-styles-decoration-bars';

suite('Continuation badge rendering', () => {
    const renderScript = getViewerDataHelpersRender();

    test('should show [+] label without inline count when collapsed', () => {
        /* The collapsed label should be exactly '[+]' — no line count in the visible text.
           The old format was '[+' + count + ' lines]' which cluttered the UI. */
        assert.ok(
            renderScript.includes("'[+]'"),
            'collapsed contLabel should be [+] without count',
        );
        assert.ok(
            !renderScript.includes("'[+' + item.contChildCount"),
            'collapsed label must NOT embed contChildCount in visible text',
        );
    });

    test('should show [−] label without inline count when expanded', () => {
        /* The expanded label should be exactly '[−]' (unicode minus \u2212).
           The old format was '[−' + count + ' lines]'. */
        assert.ok(
            renderScript.includes("'[\\u2212]'"),
            'expanded contLabel should be [−] without count',
        );
    });

    test('should include count in tooltip for both states', () => {
        /* Both collapsed and expanded tooltips should tell the user how many
           continuation lines are hidden/shown, so the count is accessible on hover. */
        assert.ok(
            renderScript.includes("'Click to expand ' + item.contChildCount + ' continuation lines'"),
            'collapsed tooltip should include contChildCount',
        );
        assert.ok(
            renderScript.includes("'Click to collapse ' + item.contChildCount + ' continuation lines'"),
            'expanded tooltip should include contChildCount',
        );
    });

    test('should place contBadge right after deco in render output', () => {
        /* The badge must come right after the decoration prefix (deco) so it sits
           next to the line counter, not at the end of the line where it overlaps text.
           Previously contBadge was appended after html, causing overlap. */
        assert.ok(
            renderScript.includes('deco + contBadge +'),
            'contBadge should follow immediately after deco in the render string',
        );
        assert.ok(
            !renderScript.includes('html + contBadge'),
            'contBadge must NOT be placed after html (old overlapping position)',
        );
    });

    test('should set data-cont-gid attribute for click handler', () => {
        /* The click handler uses e.target.closest('.cont-badge') and reads
           dataset.contGid, so the badge must emit this data attribute. */
        assert.ok(
            renderScript.includes('data-cont-gid'),
            'badge must include data-cont-gid attribute for click handling',
        );
    });
});

suite('Continuation badge CSS', () => {
    const css = getDecorationBarStyles();

    test('should use inline-block positioning (not absolute)', () => {
        /* The badge was previously position:absolute right:8px which floated over text.
           It must now be inline-block so it flows naturally next to the counter. */
        const contRule = css.match(/\.cont-badge\s*\{[^}]*\}/s)?.[0] ?? '';
        assert.ok(
            contRule.includes('inline-block'),
            '.cont-badge should use display: inline-block',
        );
        assert.ok(
            !contRule.includes('position: absolute'),
            '.cont-badge must NOT use position: absolute (causes text overlap)',
        );
        assert.ok(
            !contRule.includes('right:') && !contRule.includes('right :'),
            '.cont-badge must NOT use right positioning (old floating style)',
        );
    });

    test('should have margin for spacing from adjacent elements', () => {
        /* Margin prevents the badge from crowding the decoration prefix or log text. */
        const contRule = css.match(/\.cont-badge\s*\{[^}]*\}/s)?.[0] ?? '';
        assert.ok(
            contRule.includes('margin'),
            '.cont-badge should have margin for spacing',
        );
    });

    test('should have hover style for discoverability', () => {
        assert.ok(
            css.includes('.cont-badge:hover'),
            '.cont-badge:hover rule should exist for interactive feedback',
        );
    });
});
