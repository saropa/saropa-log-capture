import * as assert from 'assert';
import { getContinuationScript } from '../../ui/viewer/viewer-data-add-continuation';

suite('Continuation line collapsing', () => {
    test('should produce valid JavaScript', () => {
        const script = getContinuationScript();
        assert.doesNotThrow(() => new Function(script), 'continuation script should parse without syntax errors');
    });

    test('should define all expected state variables', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('var activeContHeader = null'));
        assert.ok(script.includes('var nextContGroupId = 0'));
        assert.ok(script.includes('var contHeaderMap = {}'));
        assert.ok(script.includes('var contMaxChildren = 200'));
        assert.ok(script.includes('var contAutoCollapseThreshold = 5'));
        assert.ok(script.includes('var lastNormalLineForCont = null'));
    });

    test('should define all expected functions', () => {
        const script = getContinuationScript();
        const expected = [
            'matchesContinuation', 'finalizeContinuationGroup',
            'checkContinuationOnNormalLine', 'breakContinuationGroup',
            'toggleContinuationGroup', 'resetContinuationState',
            'cleanupContinuationAfterTrim', 'expandContinuationForSearch',
        ];
        for (const fn of expected) {
            assert.ok(script.includes(`function ${fn}`), `should define ${fn}`);
        }
    });

    test('should guard against null timestamps in matchesContinuation', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('item.timestamp == null'));
        assert.ok(script.includes('prev.timestamp == null'));
    });

    test('should enforce max children limit', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('activeContHeader.contChildCount < contMaxChildren'));
    });

    test('should skip separators from continuation detection', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('lineItem.isSeparator'));
    });

    test('finalizeContinuationGroup should adjust totalHeight when auto-collapsing', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('totalHeight -= allLines[ci].height'), 'should subtract child heights from totalHeight on auto-collapse');
    });

    test('expandContinuationForSearch should call recalcHeights after expanding', () => {
        const script = getContinuationScript();
        const fnBody = script.substring(script.indexOf('function expandContinuationForSearch'));
        assert.ok(fnBody.includes('recalcHeights'), 'should recalc after search-expand');
    });
});

suite('Continuation behavioral (eval)', () => {
    /** Build a sandboxed environment with the continuation script and minimal stubs. */
    function buildEnv(): Record<string, unknown> {
        const script = getContinuationScript();
        // Provide stubs that the continuation script references
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

    function makeLine(ts: number, logcatTag: string | null, source: string): Record<string, unknown> {
        return { type: 'line', timestamp: ts, logcatTag, source, isSeparator: false, height: 20 };
    }

    test('should form a group from two consecutive lines with same ts and tag', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1 = makeLine(1000, 'flutter', 'debug');
        const line2 = makeLine(1000, 'flutter', 'debug');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line1.contChildCount, 1, 'header should have 1 child');
        assert.strictEqual(line2.contIsChild, true, 'second line should be a child');
        assert.strictEqual(line1.contGroupId, line2.contGroupId, 'should share the same group id');
    });

    test('should NOT group lines with different timestamps', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1 = makeLine(1000, 'flutter', 'debug');
        const line2 = makeLine(2000, 'flutter', 'debug');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line1.contChildCount, undefined, 'should not be a header');
        assert.strictEqual(line2.contIsChild, undefined, 'should not be a child');
    });

    test('should NOT group lines with different logcat tags', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1 = makeLine(1000, 'flutter', 'debug');
        const line2 = makeLine(1000, 'EGL_emulation', 'debug');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, undefined, 'different tag should not form group');
    });

    test('should auto-collapse groups with >5 children on finalization', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;

        // Create 7 lines: 1 header + 6 children (>5 threshold)
        for (let i = 0; i < 7; i++) {
            const line = makeLine(1000, 'flutter', 'debug');
            line.height = 20;
            lines.push(line);
            env.totalHeight = (env.totalHeight as number) + 20;
            check(line);
        }
        breakGroup(); // finalize

        const header = lines[0];
        assert.strictEqual(header.contCollapsed, true, 'should auto-collapse');
        assert.strictEqual(header.contChildCount, 6, 'should have 6 children');
    });

    test('should NOT auto-collapse groups with <=5 children', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;

        // 4 lines: 1 header + 3 children (<=5 threshold)
        for (let i = 0; i < 4; i++) {
            const line = makeLine(1000, 'flutter', 'debug');
            lines.push(line);
            check(line);
        }
        breakGroup();

        assert.strictEqual(lines[0].contCollapsed, false, 'should NOT auto-collapse');
    });

    test('finalizeContinuationGroup should subtract child heights from totalHeight', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;

        env.totalHeight = 0;
        for (let i = 0; i < 8; i++) {
            const line = makeLine(1000, 'flutter', 'debug');
            line.height = 20;
            lines.push(line);
            env.totalHeight = (env.totalHeight as number) + 20;
            check(line);
        }
        // totalHeight = 8 * 20 = 160
        assert.strictEqual(env.totalHeight, 160);

        breakGroup(); // auto-collapse: 7 children get height 0

        // Header keeps height 20, 7 children should be 0 → totalHeight = 20
        assert.strictEqual(env.totalHeight, 20, 'should subtract collapsed children from totalHeight');
    });

    test('should break continuation on marker/non-line items', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;

        const line1 = makeLine(1000, 'flutter', 'debug');
        const line2 = makeLine(1000, 'flutter', 'debug');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        breakGroup(); // simulate marker arrival

        const line3 = makeLine(1000, 'flutter', 'debug');
        lines.push(line3);
        check(line3);

        // line3 should NOT be part of the old group
        assert.notStrictEqual(line3.contGroupId, line1.contGroupId);
    });

    test('toggleContinuationGroup should flip collapsed state', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;
        const toggle = env.toggleContinuationGroup as (gid: number) => void;

        for (let i = 0; i < 8; i++) {
            const line = makeLine(1000, 'flutter', 'debug');
            line.height = 20;
            lines.push(line);
            check(line);
        }
        breakGroup(); // auto-collapses

        const gid = lines[0].contGroupId as number;
        assert.strictEqual(lines[0].contCollapsed, true);

        toggle(gid);
        assert.strictEqual(lines[0].contCollapsed, false, 'should expand');

        toggle(gid);
        assert.strictEqual(lines[0].contCollapsed, true, 'should collapse again');
    });

    test('expandContinuationForSearch should expand collapsed group and recalc', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;
        const breakGroup = env.breakContinuationGroup as () => void;
        const expandSearch = env.expandContinuationForSearch as (idx: number) => void;

        for (let i = 0; i < 8; i++) {
            const line = makeLine(1000, 'flutter', 'debug');
            line.height = 20;
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

        const line1 = makeLine(1000, 'flutter', 'debug');
        const line2 = makeLine(1000, 'flutter', 'debug');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);
        assert.ok(Object.keys(map).length > 0, 'should have entries before reset');

        reset();
        assert.strictEqual(Object.keys(map).length, 0, 'contHeaderMap should be empty');
    });

    test('should fall back to source matching when no logcatTag', () => {
        const env = buildEnv();
        const lines = env.allLines as Record<string, unknown>[];
        const check = env.checkContinuationOnNormalLine as (item: Record<string, unknown>) => void;

        const line1 = makeLine(1000, null, 'terminal');
        const line2 = makeLine(1000, null, 'terminal');
        lines.push(line1);
        check(line1);
        lines.push(line2);
        check(line2);

        assert.strictEqual(line2.contIsChild, true, 'should group by source when no logcatTag');
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
});
