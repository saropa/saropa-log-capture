import * as assert from 'assert';
import { getContinuationScript } from '../../ui/viewer/viewer-data-add-continuation';

suite('Continuation edge cases (eval)', () => {
    /** Build a sandboxed environment with the continuation script and minimal stubs. */
    function buildEnv(): Record<string, unknown> {
        const script = getContinuationScript();
        const setup = `
            var allLines = [];
            var totalHeight = 0;
            var contHeaderMap = {};
            var recalcHeightsCalled = false;
            function recalcHeights() { recalcHeightsCalled = true; }
            function renderViewport() {}
            ${script}
        `;
        const fn = new Function(setup + `
            return {
                allLines: allLines,
                get totalHeight() { return totalHeight; },
                set totalHeight(v) { totalHeight = v; },
                contHeaderMap: contHeaderMap,
                checkContinuationOnNormalLine: checkContinuationOnNormalLine,
                breakContinuationGroup: breakContinuationGroup,
                finalizeContinuationGroup: finalizeContinuationGroup,
                resetContinuationState: resetContinuationState,
                toggleContinuationGroup: toggleContinuationGroup,
                expandContinuationForSearch: expandContinuationForSearch,
                cleanupContinuationAfterTrim: cleanupContinuationAfterTrim,
                get recalcHeightsCalled() { return recalcHeightsCalled; },
                set recalcHeightsCalled(v) { recalcHeightsCalled = v; },
            };
        `);
        return fn() as Record<string, unknown>;
    }

    test('should NOT group lines with no logcatTag even when source and timestamp match', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, source: 'terminal', isSeparator: false, height: 20 };
        const line2: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, source: 'terminal', isSeparator: false, height: 20 };
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, undefined, 'should NOT group when no logcatTag');
    });

    test('should group console lines without logcatTag when same category and child has no sourceTag', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, category: 'console', sourceTag: 'log', source: 'debug', isSeparator: false, height: 20 };
        const line2: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, category: 'console', sourceTag: null, source: 'debug', isSeparator: false, height: 20 };
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, true, 'should group: same ts, same category, child has no sourceTag');
    });

    test('should NOT group console lines when child has a sourceTag (signals new log entry)', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, category: 'console', sourceTag: 'log', source: 'debug', isSeparator: false, height: 20 };
        const line2: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: null, category: 'console', sourceTag: 'log', source: 'debug', isSeparator: false, height: 20 };
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, undefined, 'should NOT group: child has sourceTag [log], indicating a new entry');
    });

    test('should NOT group lines with null timestamps', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1: Record<string, unknown> = { type: 'line', timestamp: null, logcatTag: 'flutter', source: 'debug', isSeparator: false, height: 20 };
        const line2: Record<string, unknown> = { type: 'line', timestamp: null, logcatTag: 'flutter', source: 'debug', isSeparator: false, height: 20 };
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, undefined, 'null timestamps should not form group');
    });

    test('expandContinuationForSearch should expand collapsed group and recalc', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;
        const expandSearch = env.expandContinuationForSearch as (idx: number) => void;

        for (let i = 0; i < 8; i++) {
            const line: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: 'flutter', source: 'debug', isSeparator: false, height: 20 };
            lines.push(line);
            check(line);
        }
        breakGroup(); // auto-collapses
        assert.strictEqual(lines[0].contCollapsed, true);

        env.recalcHeightsCalled = false;
        expandSearch(3); // expand via child at index 3
        assert.strictEqual(lines[0].contCollapsed, false, 'should expand');
        assert.strictEqual(env.recalcHeightsCalled, true, 'should call recalcHeights');
    });

    test('resetContinuationState should clear all state', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const reset = env.resetContinuationState as () => void;
        const map = env.contHeaderMap as Record<string, unknown>;

        const line1: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: 'flutter', source: 'debug', isSeparator: false, height: 20 };
        const line2: Record<string, unknown> = { type: 'line', timestamp: 1000, logcatTag: 'flutter', source: 'debug', isSeparator: false, height: 20 };
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);
        assert.ok(Object.keys(map).length > 0, 'should have entries before reset');

        reset();
        assert.strictEqual(Object.keys(map).length, 0, 'contHeaderMap should be empty');
    });
});
