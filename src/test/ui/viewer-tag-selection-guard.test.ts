import * as assert from 'assert';
import { getTagSelectionGuardScript } from '../../ui/viewer-stack-tags/viewer-tag-selection-guard';
import { getSourceTagsScript } from '../../ui/viewer-stack-tags/viewer-source-tags';
import { getClassTagsScript } from '../../ui/viewer-stack-tags/viewer-class-tags';

suite('Viewer Tag Selection Guard', () => {
    function createGuardFn(): (hiddenTags: Record<string, boolean>, tagCounts: Record<string, number>) => Record<string, boolean> {
        const factory = new Function(
            `${getTagSelectionGuardScript()}\nreturn ensureAtLeastOneTagVisible;`,
        ) as () => (hiddenTags: Record<string, boolean>, tagCounts: Record<string, number>) => Record<string, boolean>;
        return factory();
    }

    test('resets to all-visible when toggle state hides all known tags', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true, beta: true };
        const counts = { alpha: 12, beta: 5 };
        assert.deepStrictEqual(ensureVisible(hidden, counts), {});
    });

    test('keeps state when at least one tag remains visible (false-positive guard)', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true };
        const counts = { alpha: 12, beta: 5 };
        assert.deepStrictEqual(ensureVisible(hidden, counts), hidden);
    });

    test('does not reset when there are no known tags (false-positive guard)', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true };
        assert.deepStrictEqual(ensureVisible(hidden, {}), hidden);
    });

    test('source and class tag toggles use shared guard helper', () => {
        const sourceScript = getSourceTagsScript();
        const classScript = getClassTagsScript();

        assert.ok(sourceScript.includes('ensureAtLeastOneTagVisible(hiddenSourceTags, sourceTagCounts)'));
        assert.ok(classScript.includes('ensureAtLeastOneTagVisible(hiddenClassTags, classTagCounts)'));

        // Ensure legacy duplicated loops are gone from both toggles.
        assert.ok(!sourceScript.includes('var visibleCount = 0;'));
        assert.ok(!classScript.includes('var visibleCount = 0;'));
    });
});

