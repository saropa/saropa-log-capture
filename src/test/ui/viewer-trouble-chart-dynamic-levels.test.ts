import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleModeScript } from '../../ui/viewer-search-filter/viewer-trouble-mode';
import { getTroubleChartScript } from '../../ui/viewer-search-filter/viewer-trouble-chart';

/**
 * Dynamic trouble chart bucketing — verifies that bars, totals, and legend
 * respond to non-default TROUBLE_LEVELS sets (database, todo, debug, notice).
 *
 * The default tests (viewer-trouble-chart.test.ts) only exercise the three
 * default levels. This suite exercises setTroubleLevels + rebuildActiveChartLevels
 * to confirm the chart dynamically adapts to custom level configurations.
 */

function buildChartCtx(): Record<string, unknown> {
  const ctx = vm.createContext({ allLines: [], Number, console }) as Record<string, unknown>;
  vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'trouble-chart-dynamic.js' });
  return ctx;
}

interface DynamicBucket {
  key: number;
  firstLine: number | null;
  [level: string]: number | null;
}

interface DynamicTotals { [level: string]: number }
interface DynamicBucketResult {
  bins: DynamicBucket[];
  maxTotal: number;
  intervalMs: number;
  totals: DynamicTotals;
}

function buckets(ctx: Record<string, unknown>): DynamicBucketResult {
  return (ctx.buildTroubleChartBuckets as () => DynamicBucketResult)();
}

function setLevels(ctx: Record<string, unknown>, levels: string[]): void {
  (ctx.setTroubleLevels as (l: string[]) => void)(levels);
}

// Cross-realm arrays from vm.createContext don't share Array.prototype,
// so deepStrictEqual fails on type. Spread into a host-realm array.
function getActiveChartLevels(ctx: Record<string, unknown>): string[] {
  return [...(ctx.activeChartLevels as string[])];
}

suite('Trouble chart dynamic level bucketing', () => {

  test('should bucket database lines when database is in TROUBLE_LEVELS', () => {
    const ctx = buildChartCtx();
    setLevels(ctx, ['error', 'database']);
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'database', timestamp: 10_500, viewerLineIndex: 1 },
      { type: 'line', level: 'database', timestamp: 11_000, viewerLineIndex: 2 },
      { type: 'line', level: 'warning', timestamp: 11_500, viewerLineIndex: 3 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1, 'single 5s window');
    assert.strictEqual(r.totals.error, 1);
    assert.strictEqual(r.totals.database, 2);
    assert.strictEqual(r.totals.warning, undefined, 'warning not in active levels');
  });

  test('should update activeChartLevels after setTroubleLevels', () => {
    const ctx = buildChartCtx();
    const before = getActiveChartLevels(ctx);
    assert.deepStrictEqual(before, ['error', 'warning', 'performance'], 'defaults');

    setLevels(ctx, ['error', 'todo', 'notice']);
    const after = getActiveChartLevels(ctx);
    assert.deepStrictEqual(after, ['error', 'todo', 'notice']);
  });

  test('should preserve canonical stacking order regardless of input order', () => {
    const ctx = buildChartCtx();
    setLevels(ctx, ['notice', 'error', 'debug']);
    const levels = getActiveChartLevels(ctx);
    assert.deepStrictEqual(levels, ['error', 'debug', 'notice'],
      'canonical order: error before debug before notice');
  });

  test('should exclude levels not in TROUBLE_LEVELS from totals', () => {
    const ctx = buildChartCtx();
    setLevels(ctx, ['error']);
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 10_500, viewerLineIndex: 1 },
      { type: 'line', level: 'performance', timestamp: 11_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.totals.error, 1);
    assert.strictEqual(r.totals.warning, undefined, 'warning excluded');
    assert.strictEqual(r.totals.performance, undefined, 'performance excluded');
    assert.strictEqual(r.maxTotal, 1, 'only error counted');
  });

  test('should handle all seven levels simultaneously', () => {
    const ctx = buildChartCtx();
    setLevels(ctx, ['error', 'warning', 'performance', 'database', 'todo', 'debug', 'notice']);
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 10_100, viewerLineIndex: 1 },
      { type: 'line', level: 'performance', timestamp: 10_200, viewerLineIndex: 2 },
      { type: 'line', level: 'database', timestamp: 10_300, viewerLineIndex: 3 },
      { type: 'line', level: 'todo', timestamp: 10_400, viewerLineIndex: 4 },
      { type: 'line', level: 'debug', timestamp: 10_500, viewerLineIndex: 5 },
      { type: 'line', level: 'notice', timestamp: 10_600, viewerLineIndex: 6 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1);
    assert.strictEqual(r.maxTotal, 7, 'all seven counted');
    const levels = getActiveChartLevels(ctx);
    assert.strictEqual(levels.length, 7);
    for (const lvl of levels) {
      assert.strictEqual(r.totals[lvl], 1, `${lvl} total = 1`);
    }
  });

  test('should ignore setTroubleLevels with empty array', () => {
    const ctx = buildChartCtx();
    setLevels(ctx, []);
    const levels = getActiveChartLevels(ctx);
    assert.deepStrictEqual(levels, ['error', 'warning', 'performance'],
      'defaults preserved after empty set');
  });

  test('should rebuild chart data after mid-session level change', () => {
    const ctx = buildChartCtx();
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'database', timestamp: 10_500, viewerLineIndex: 1 },
    ];
    const r1 = buckets(ctx);
    assert.strictEqual(r1.totals.error, 1);
    assert.strictEqual(r1.totals.database, undefined, 'database not active yet');

    setLevels(ctx, ['error', 'database']);
    const r2 = buckets(ctx);
    assert.strictEqual(r2.totals.error, 1);
    assert.strictEqual(r2.totals.database, 1, 'database now counted');
  });
});
