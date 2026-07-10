import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getWarmupFilterScript } from '../../ui/viewer-search-filter/viewer-warmup-filter';

/**
 * Warm-up filter (opt-in): hides lines captured at or before the app-ready boundary — the
 * device backlog + build output the severity chart already trims. Pins the classification and
 * the boundary-change re-apply in a DOM-less VM (the script's IIFE self-guards on `document`).
 */

interface Line { type: string; timestamp: number; warmupFiltered?: boolean }

/** Load the filter with a stubbed boundary and allLines; no `document` so the IIFE no-ops. */
function load(boundary: number, allLines: Line[]): Record<string, unknown> {
    let recalcs = 0;
    const ctx = vm.createContext({
        allLines,
        troubleChartLaunchTs: () => boundary,
        recalcAndRender: () => { recalcs++; },
        __recalcs: () => recalcs,
    }) as Record<string, unknown>;
    vm.runInContext(getWarmupFilterScript(), ctx, { filename: 'warmup.js' });
    return ctx;
}

suite('Warm-up filter — classification', () => {
    test('off by default: nothing is warm-up even before the boundary', () => {
        const ctx = load(1000, []);
        const calc = ctx.calcWarmupFiltered as (n: number) => boolean;
        assert.strictEqual(calc(500), false, 'a pre-boundary line is not filtered while off');
    });

    test('on: lines at or before the boundary are warm-up, later lines are not', () => {
        const lines: Line[] = [
            { type: 'line', timestamp: 500 },   // before boundary → warm-up
            { type: 'line', timestamp: 1000 },  // exactly at boundary → warm-up
            { type: 'line', timestamp: 1500 },  // after boundary → real
            { type: 'marker', timestamp: 500 }, // markers never filtered
            { type: 'line', timestamp: 0 },     // no timestamp → never warm-up
        ];
        const ctx = load(1000, lines);
        ctx.excludeWarmupLogs = true;
        (ctx.applyWarmupFilter as () => void)();

        assert.strictEqual(lines[0].warmupFiltered, true, 'pre-boundary line hidden');
        assert.strictEqual(lines[1].warmupFiltered, true, 'boundary line hidden');
        assert.strictEqual(lines[2].warmupFiltered, false, 'app-era line kept');
        assert.strictEqual(lines[3].warmupFiltered, undefined, 'marker untouched');
        assert.strictEqual(lines[4].warmupFiltered, false, 'untimestamped line kept');
    });

    test('with no boundary yet, nothing is warm-up even when on', () => {
        const lines: Line[] = [{ type: 'line', timestamp: 500 }];
        const ctx = load(0, lines);
        ctx.excludeWarmupLogs = true;
        (ctx.applyWarmupFilter as () => void)();
        assert.strictEqual(lines[0].warmupFiltered, false, 'unresolved boundary excludes nothing');
    });
});

suite('Warm-up filter — boundary-change re-apply', () => {
    test('re-applies exactly once when the boundary first resolves', () => {
        const lines: Line[] = [{ type: 'line', timestamp: 500 }];
        // Boundary starts at 0 (unresolved), then resolves to 1000 on a later batch.
        let boundary = 0;
        const ctx = vm.createContext({
            allLines: lines,
            troubleChartLaunchTs: () => boundary,
            recalcAndRender: () => {},
        }) as Record<string, unknown>;
        vm.runInContext(getWarmupFilterScript(), ctx, { filename: 'warmup.js' });
        ctx.excludeWarmupLogs = true;
        (ctx.applyWarmupFilter as () => void)();
        assert.strictEqual(lines[0].warmupFiltered, false, 'nothing hidden while boundary unresolved');

        boundary = 1000;
        (ctx.maybeReapplyWarmupOnBoundaryChange as () => void)();
        assert.strictEqual(lines[0].warmupFiltered, true, 're-applied once the boundary resolved');
    });

    test('reset clears the toggle and the applied boundary', () => {
        const ctx = load(1000, []);
        ctx.excludeWarmupLogs = true;
        (ctx.applyWarmupFilter as () => void)();
        (ctx.resetWarmupFilter as () => void)();
        assert.strictEqual(ctx.excludeWarmupLogs, false, 'toggle cleared');
        assert.strictEqual(ctx.warmupAppliedBoundary, -1, 'applied boundary cleared');
    });
});
