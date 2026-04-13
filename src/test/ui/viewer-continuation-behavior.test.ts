import * as assert from 'assert';
import { getContinuationScript } from '../../ui/viewer/viewer-data-add-continuation';

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

});
