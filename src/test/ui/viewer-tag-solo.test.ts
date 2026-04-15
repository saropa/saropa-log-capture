import * as assert from 'node:assert';
import { getClassTagsScript } from '../../ui/viewer-stack-tags/viewer-class-tags';
import { getSourceTagsScript } from '../../ui/viewer-stack-tags/viewer-source-tags';
import { getTagSelectionGuardScript } from '../../ui/viewer-stack-tags/viewer-tag-selection-guard';

/**
 * Tests for double-click solo behavior on Code Origins (class tags) and
 * Message Tags (source tags) filter chips.
 *
 * The solo functions live in webview JS emitted by template literals, so we
 * eval them via `new Function` with a minimal DOM stub — the same pattern
 * used by viewer-tag-selection-guard.test.ts and viewer-source-tags-noise.test.ts.
 */

interface ClassTagRuntime {
    classTagCounts: Record<string, number>;
    hiddenClassTags: Record<string, boolean>;
    savedHiddenClassTags: Record<string, boolean> | null;
    soloedClassTag: string | null;
    soloClassTag: (tag: string) => void;
    toggleClassTag: (tag: string) => void;
    selectAllClassTags: () => void;
    deselectAllClassTags: () => void;
    resetClassTags: () => void;
}

interface SourceTagRuntime {
    sourceTagCounts: Record<string, number>;
    hiddenSourceTags: Record<string, boolean>;
    savedHiddenSourceTags: Record<string, boolean> | null;
    soloedSourceTag: string | null;
    soloSourceTag: (tag: string) => void;
    toggleSourceTag: (tag: string) => void;
    selectAllTags: () => void;
    deselectAllTags: () => void;
    resetSourceTags: () => void;
}

/** Create a class-tag runtime with the guard script and a no-op DOM. */
function createClassTagRuntime(): ClassTagRuntime {
    const guard = getTagSelectionGuardScript();
    const script = getClassTagsScript();
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
            get classTagCounts() { return classTagCounts; },
            set classTagCounts(v) { classTagCounts = v; },
            get hiddenClassTags() { return hiddenClassTags; },
            set hiddenClassTags(v) { hiddenClassTags = v; },
            get savedHiddenClassTags() { return savedHiddenClassTags; },
            get soloedClassTag() { return soloedClassTag; },
            soloClassTag: soloClassTag,
            toggleClassTag: toggleClassTag,
            selectAllClassTags: selectAllClassTags,
            deselectAllClassTags: deselectAllClassTags,
            resetClassTags: resetClassTags,
        };
    `) as () => ClassTagRuntime;
    return factory();
}

/** Create a source-tag runtime with the guard script and a no-op DOM. */
function createSourceTagRuntime(): SourceTagRuntime {
    const guard = getTagSelectionGuardScript();
    const script = getSourceTagsScript();
    const factory = new Function(`
        var document = { getElementById: function() { return null; } };
        var allLines = [];
        function recalcHeights() {}
        function renderViewport() {}
        function recalcAndRender() {}
        function markPresetDirty() {}
        function stripTags(s) { return String(s || ''); }
        ${guard}
        ${script}
        return {
            get sourceTagCounts() { return sourceTagCounts; },
            set sourceTagCounts(v) { sourceTagCounts = v; },
            get hiddenSourceTags() { return hiddenSourceTags; },
            set hiddenSourceTags(v) { hiddenSourceTags = v; },
            get savedHiddenSourceTags() { return savedHiddenSourceTags; },
            get soloedSourceTag() { return soloedSourceTag; },
            soloSourceTag: soloSourceTag,
            toggleSourceTag: toggleSourceTag,
            selectAllTags: selectAllTags,
            deselectAllTags: deselectAllTags,
            resetSourceTags: resetSourceTags,
        };
    `) as () => SourceTagRuntime;
    return factory();
}

suite('Viewer Tag Solo — Class Tags (Code Origins)', () => {
    test('should solo a tag by hiding all others', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3, Gamma: 2 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Beta');

        assert.strictEqual(rt.hiddenClassTags['Alpha'], true);
        assert.strictEqual(rt.hiddenClassTags['Beta'], undefined);
        assert.strictEqual(rt.hiddenClassTags['Gamma'], true);
        assert.strictEqual(rt.soloedClassTag, 'Beta');
    });

    test('should restore previous state on second solo of same tag', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3, Gamma: 2 };
        /* Start with Alpha already hidden. */
        rt.hiddenClassTags = { Alpha: true };

        rt.soloClassTag('Beta');
        assert.strictEqual(rt.soloedClassTag, 'Beta');

        /* Second solo on same tag restores original state. */
        rt.soloClassTag('Beta');
        assert.strictEqual(rt.soloedClassTag, null);
        assert.strictEqual(rt.savedHiddenClassTags, null);
        assert.deepStrictEqual(rt.hiddenClassTags, { Alpha: true });
    });

    test('should switch solo target when soloing a different tag', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3, Gamma: 2 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Alpha');
        assert.strictEqual(rt.soloedClassTag, 'Alpha');

        /* Solo a different tag — saves the solo state, switches to new target. */
        rt.soloClassTag('Gamma');
        assert.strictEqual(rt.soloedClassTag, 'Gamma');
        assert.strictEqual(rt.hiddenClassTags['Alpha'], true);
        assert.strictEqual(rt.hiddenClassTags['Beta'], true);
        assert.strictEqual(rt.hiddenClassTags['Gamma'], undefined);
    });

    test('should clear solo state on manual toggle', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3, Gamma: 2 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Alpha');
        assert.strictEqual(rt.soloedClassTag, 'Alpha');

        rt.toggleClassTag('Beta');
        assert.strictEqual(rt.soloedClassTag, null);
        assert.strictEqual(rt.savedHiddenClassTags, null);
    });

    test('should clear solo state on selectAll', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Alpha');
        rt.selectAllClassTags();

        assert.strictEqual(rt.soloedClassTag, null);
        assert.strictEqual(rt.savedHiddenClassTags, null);
        assert.deepStrictEqual(rt.hiddenClassTags, {});
    });

    test('should clear solo state on deselectAll', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Alpha');
        rt.deselectAllClassTags();

        assert.strictEqual(rt.soloedClassTag, null);
        assert.strictEqual(rt.savedHiddenClassTags, null);
    });

    test('should clear solo state on reset', () => {
        const rt = createClassTagRuntime();
        rt.classTagCounts = { Alpha: 5, Beta: 3 };
        rt.hiddenClassTags = {};

        rt.soloClassTag('Alpha');
        rt.resetClassTags();

        assert.strictEqual(rt.soloedClassTag, null);
        assert.strictEqual(rt.savedHiddenClassTags, null);
    });
});

suite('Viewer Tag Solo — Source Tags (Message Tags)', () => {
    test('should solo a tag by hiding all others', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5, db: 3 };
        rt.hiddenSourceTags = {};

        rt.soloSourceTag('log');

        assert.strictEqual(rt.hiddenSourceTags['flutter'], true);
        assert.strictEqual(rt.hiddenSourceTags['log'], undefined);
        assert.strictEqual(rt.hiddenSourceTags['db'], true);
        assert.strictEqual(rt.soloedSourceTag, 'log');
    });

    test('should restore previous state on second solo of same tag', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5, db: 3 };
        /* Start with db already hidden. */
        rt.hiddenSourceTags = { db: true };

        rt.soloSourceTag('log');
        assert.strictEqual(rt.soloedSourceTag, 'log');

        /* Second solo on same tag restores the original state (db hidden). */
        rt.soloSourceTag('log');
        assert.strictEqual(rt.soloedSourceTag, null);
        assert.strictEqual(rt.savedHiddenSourceTags, null);
        assert.deepStrictEqual(rt.hiddenSourceTags, { db: true });
    });

    test('should clear solo state on manual toggle', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5, db: 3 };
        rt.hiddenSourceTags = {};

        rt.soloSourceTag('flutter');
        assert.strictEqual(rt.soloedSourceTag, 'flutter');

        rt.toggleSourceTag('db');
        assert.strictEqual(rt.soloedSourceTag, null);
        assert.strictEqual(rt.savedHiddenSourceTags, null);
    });

    test('should clear solo state on selectAll', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5 };
        rt.hiddenSourceTags = {};

        rt.soloSourceTag('flutter');
        rt.selectAllTags();

        assert.strictEqual(rt.soloedSourceTag, null);
        assert.deepStrictEqual(rt.hiddenSourceTags, {});
    });

    test('should clear solo state on deselectAll', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5 };
        rt.hiddenSourceTags = {};

        rt.soloSourceTag('flutter');
        rt.deselectAllTags();

        assert.strictEqual(rt.soloedSourceTag, null);
    });

    test('should clear solo state on reset', () => {
        const rt = createSourceTagRuntime();
        rt.sourceTagCounts = { flutter: 10, log: 5 };
        rt.hiddenSourceTags = {};

        rt.soloSourceTag('flutter');
        rt.resetSourceTags();

        assert.strictEqual(rt.soloedSourceTag, null);
        assert.strictEqual(rt.savedHiddenSourceTags, null);
    });
});
