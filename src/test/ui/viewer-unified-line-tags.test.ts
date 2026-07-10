import * as assert from 'node:assert';
import { getSourceTagsScript } from '../../ui/viewer-stack-tags/viewer-source-tags';
import { getTagSelectionGuardScript } from '../../ui/viewer-stack-tags/viewer-tag-selection-guard';

/**
 * Unified line tags: one set per line drives BOTH the log chips and the Message
 * Tags sidebar. addToData builds item.tags (bracket head tags + device/logcat/
 * source tag, deduped); the source-tag registry counts and filters every key in
 * that set. This pins the two contracts that the old split broke:
 *   - registerSourceTag counts EVERY tag on a line (not just the first).
 *   - a line hides only when ALL its tags are hidden (toggling any one back on
 *     reveals it) — the reason toggling a chip used to appear to do nothing.
 */
interface Runtime {
    sourceTagCounts: Record<string, number>;
    hiddenSourceTags: Record<string, boolean>;
    setLines: (lines: unknown[]) => void;
    registerSourceTag: (item: unknown) => void;
    computeSourceFiltered: (item: unknown) => boolean;
    applySourceTagFilter: () => void;
}

function createRuntime(): Runtime {
    const guard = getTagSelectionGuardScript();
    const script = getSourceTagsScript();
    const factory = new Function(`
        var document = { getElementById: function() { return null; } };
        var allLines = [];
        function recalcHeights() {}
        function renderViewport() {}
        function recalcAndRender() {}
        function markPresetDirty() {}
        ${guard}
        ${script}
        return {
            get sourceTagCounts() { return sourceTagCounts; },
            get hiddenSourceTags() { return hiddenSourceTags; },
            set hiddenSourceTags(v) { hiddenSourceTags = v; },
            setLines: function(v) { allLines = v; },
            registerSourceTag: registerSourceTag,
            computeSourceFiltered: computeSourceFiltered,
            applySourceTagFilter: applySourceTagFilter,
        };
    `) as () => Runtime;
    return factory();
}

/** A line item carrying the unified item.tags set. */
function line(tags: Array<{ name: string; key: string; level: string }>): Record<string, unknown> {
    return { type: 'line', tags, sourceFiltered: false };
}

suite('unified line tags — registry + filter', () => {
    test('registerSourceTag counts EVERY tag on a line, not just the first', () => {
        const rt = createRuntime();
        rt.registerSourceTag(line([
            { name: 'perf', key: 'perf', level: 'performance' },
            { name: 'frame-stall', key: 'frame-stall', level: 'performance' },
            { name: 'flutter', key: 'flutter', level: 'info' },
        ]));
        assert.strictEqual(rt.sourceTagCounts.perf, 1);
        assert.strictEqual(rt.sourceTagCounts['frame-stall'], 1, 'the second bracket tag is also counted');
        assert.strictEqual(rt.sourceTagCounts.flutter, 1, 'the device/logcat tag shares the same registry');
    });

    test('a line with no tags counts under the catch-all otherKey', () => {
        const rt = createRuntime();
        rt.registerSourceTag(line([]));
        assert.strictEqual(rt.sourceTagCounts.__other__, 1);
    });

    test('a line hides only when ALL its tags are hidden', () => {
        const rt = createRuntime();
        const item = line([
            { name: 'perf', key: 'perf', level: 'performance' },
            { name: 'frame-stall', key: 'frame-stall', level: 'performance' },
        ]);
        rt.hiddenSourceTags = { perf: true };
        assert.strictEqual(rt.computeSourceFiltered(item), false, 'still visible while frame-stall is shown');
        rt.hiddenSourceTags = { perf: true, 'frame-stall': true };
        assert.strictEqual(rt.computeSourceFiltered(item), true, 'hidden once every tag is hidden');
    });

    test('applySourceTagFilter stamps sourceFiltered across all lines', () => {
        const rt = createRuntime();
        const a = line([{ name: 'perf', key: 'perf', level: 'performance' }]);
        const b = line([{ name: 'db', key: 'db', level: 'database' }]);
        rt.setLines([a, b]);
        rt.hiddenSourceTags = { perf: true };
        rt.applySourceTagFilter();
        assert.strictEqual((a as { sourceFiltered: boolean }).sourceFiltered, true, 'perf line hidden');
        assert.strictEqual((b as { sourceFiltered: boolean }).sourceFiltered, false, 'db line untouched');
    });
});
