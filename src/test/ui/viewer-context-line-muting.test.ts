/**
 * Regression tests for context-line muting across the four render paths that previously
 * rendered context-pulled rows at full color/opacity.
 *
 * Bug: in level-filter context expansion (default ±3 before each error), stack frames,
 * stack headers, repeat chips ("N × SQL repeated"), and N+1 signal chips were dragged
 * in as context but rendered through paths that ignored `item.isContext`. Result: they
 * kept their full level-* color and opacity 1.0, looking like primary error content even
 * though they were only there to provide background context. Real lines (the main render
 * branch) already applied `.context-line` correctly via `ctxCls`.
 *
 * Fix: each of the four affected paths now adds the same `context-line` / `context-first`
 * class when `item.isContext` is set. Stack-header additionally drops its `level-*` color
 * class when `isContext` so it doesn't keep a database/error tint.
 *
 * Companion fix in `applyLevelFilter`: the context-restore loop now skips
 * `repeat-notification` and `n-plus-one-signal` rows entirely. These describe the
 * surrounding SQL rather than show what led to the error, so dragging them in adds
 * noise without adding causality. Real log content (stack frames, info lines) is still
 * eligible — they often ARE what led to the error.
 */
import * as assert from 'node:assert';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getStackHeaderRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { getLevelFilterScript } from '../../ui/viewer-search-filter/viewer-level-filter';

suite('context-line muting on synthetic and stack render paths', () => {
    const renderChunk = getViewerDataHelpersRender();
    const stackChunk = getStackHeaderRenderScript();
    const filterChunk = getLevelFilterScript();

    test('chip early-return path applies context-line class when isContext', () => {
        // Repeat-notification and n-plus-one-signal share the early-return branch in
        // renderItem(). It used to emit a fixed `class="line"` regardless of isContext.
        const idx = renderChunk.indexOf("item.type === 'repeat-notification' || item.type === 'n-plus-one-signal'");
        assert.ok(idx >= 0, 'chip early-return branch must exist');
        const branch = renderChunk.substring(idx, idx + 600);
        assert.ok(
            branch.includes('item.isContext'),
            'chip render must read item.isContext to mute when pulled in as context',
        );
        assert.ok(
            branch.includes("' context-line'"),
            'chip render must add context-line class when isContext',
        );
    });

    test('stack-header drops level-* color and adds context-line when isContext', () => {
        // Without the !item.isContext guard, a stack-header dragged in as context for an
        // unrelated error keeps its full-color level-database tint (the parent SELECT's level).
        assert.ok(
            stackChunk.includes('!item.isContext') && stackChunk.includes("' level-' + item.level"),
            'hdrLevelCls must be gated on !item.isContext so context rows lose their level color',
        );
        assert.ok(
            stackChunk.includes('hdrCtxCls') && stackChunk.includes("' context-line'"),
            'stack-header render must add context-line when isContext',
        );
        assert.ok(
            stackChunk.includes("' context-first'"),
            'stack-header must mark first context row with context-first for the dashed separator',
        );
    });

    test('stack-frame applies context-line when isContext', () => {
        // Stack frames inherit their level from the header (typically database for Drift
        // traces). When pulled in as context they must mute the same way as plain lines.
        assert.ok(
            stackChunk.includes('sfCtxCls') && stackChunk.includes("' context-line'"),
            'stack-frame render must add context-line when isContext',
        );
    });

    test('applyLevelFilter context loop skips synthetic analysis rows', () => {
        // N × SQL repeated and ⚠ Potential N+1 query rows describe the surrounding SQL
        // rather than carry causality, so dragging them in as context just adds noise.
        // Real content (info lines, stack frames) is still eligible.
        const idx = filterChunk.indexOf('contextLinesBefore > 0');
        assert.ok(idx >= 0, 'context-restore loop must exist in applyLevelFilter');
        const loop = filterChunk.substring(idx, idx + 800);
        assert.ok(
            loop.includes("ctx.type === 'marker'"),
            'marker skip must remain (db-signal markers track visibility separately)',
        );
        assert.ok(
            loop.includes("ctx.type === 'repeat-notification'"),
            'context loop must skip repeat-notification chips',
        );
        assert.ok(
            loop.includes("ctx.type === 'n-plus-one-signal'"),
            'context loop must skip n-plus-one-signal chips',
        );
    });

    test('main-line render still applies context-line for plain rows (regression guard)', () => {
        // Sanity check: the existing ctxCls path must still exist — my changes
        // extended the pattern to the special-cased render branches without
        // altering the canonical path.
        assert.ok(
            renderChunk.includes("var ctxCls = item.isContext ? ' context-line'"),
            'main render path must keep its existing ctxCls handling',
        );
    });
});
