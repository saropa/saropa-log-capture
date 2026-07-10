import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleModeScript } from '../../ui/viewer-search-filter/viewer-trouble-mode';
import { getTroubleChartScript } from '../../ui/viewer-search-filter/viewer-trouble-chart';

/**
 * Trouble Mode severity chart (Stage 3) — the webview aggregation.
 *
 * Pins the two load-bearing contracts of buildTroubleChartBuckets():
 *  1. Only error/warning/performance 'line' items with a real timestamp count —
 *     markers (no level), info/debug/etc., and ts<=0 are excluded. This is the
 *     same level-badge fence the feed filters on, so the chart can never disagree.
 *  2. The window is CONTIGUOUS (empty gaps kept as zero bars so bars read as a rate)
 *     but bounded to the most-recent TROUBLE_CHART_MAX_BUCKETS windows, so an
 *     hours-long session cannot grow the array (bug 001 OOM fence — no unbounded buffer).
 *  3. The legend totals (plan 110, Stage 4) sum the RENDERED bins, not allLines — a
 *     legend counting events the capped window never draws would contradict the bars.
 */

/** Load the trouble-mode + chart scripts in a DOM-less VM (both guard on `document`). */
function buildChartCtx(): Record<string, unknown> {
  const ctx = vm.createContext({ allLines: [], Number, console }) as Record<string, unknown>;
  vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'trouble-chart.js' });
  return ctx;
}

interface Bucket { key: number; error: number; warning: number; performance: number; firstLine: number | null }
interface LevelTotals { error: number; warning: number; performance: number }
interface BucketResult { bins: Bucket[]; maxTotal: number; intervalMs: number; totals: LevelTotals }

function buckets(ctx: Record<string, unknown>): BucketResult {
  return (ctx.buildTroubleChartBuckets as () => BucketResult)();
}

suite('Trouble Mode severity chart', () => {
  test('buckets error/warning/performance by window; skips info, markers, and ts<=0', () => {
    const ctx = buildChartCtx();
    // Interval default 5s = 5000ms. Keys: 10000→2, 12000→2, 20000→4.
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 12_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', timestamp: 12_500, viewerLineIndex: 2 }, // skipped: not a trouble level
      { type: 'marker', level: 'error', timestamp: 12_600 },                   // skipped: markers carry no level
      { type: 'line', level: 'performance', timestamp: 20_000, viewerLineIndex: 3 },
      { type: 'line', level: 'error', timestamp: 0, viewerLineIndex: 4 },       // skipped: ts<=0
    ];

    const r = buckets(ctx);
    // Windows 2,3,4 — the empty window 3 is kept so the bars stay time-proportional.
    assert.strictEqual(r.bins.length, 3, 'contiguous window keys 2..4');
    assert.strictEqual(r.maxTotal, 2, 'busiest window has error+warning=2');

    assert.strictEqual(r.bins[0].error, 1, 'window 2 error');
    assert.strictEqual(r.bins[0].warning, 1, 'window 2 warning');
    assert.strictEqual(r.bins[0].performance, 0, 'window 2 no performance');
    assert.strictEqual(r.bins[0].firstLine, 0, 'window 2 first row is line index 0');

    assert.strictEqual(r.bins[1].error + r.bins[1].warning + r.bins[1].performance, 0, 'window 3 empty');

    assert.strictEqual(r.bins[2].performance, 1, 'window 4 performance');
    assert.strictEqual(r.bins[2].firstLine, 3, 'window 4 first row is line index 3');
  });

  test('window is bounded to the most-recent TROUBLE_CHART_MAX_BUCKETS windows', () => {
    const ctx = buildChartCtx();
    const cap = ctx.TROUBLE_CHART_MAX_BUCKETS as number;
    assert.strictEqual(cap, 180, 'cap constant');
    // One old event far below the window and one very recent — the old one must fall off.
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 5_000, viewerLineIndex: 0 },          // key 1
      { type: 'line', level: 'error', timestamp: 5_000_000, viewerLineIndex: 1 },       // key 1000
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, cap, 'exactly the capped number of windows');
    assert.strictEqual(r.bins[r.bins.length - 1].firstLine, 1, 'newest window is the last bar');
    assert.strictEqual(r.bins[0].firstLine, null, 'oldest in-window bar is an empty gap, old event fell off');
  });

  test('empty allLines yields no bins', () => {
    const ctx = buildChartCtx();
    ctx.allLines = [];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 0, 'no trouble events → no bars');
    assert.strictEqual(r.maxTotal, 0, 'no total');
    // Field-by-field, not deepStrictEqual: the object is built inside the VM, so its
    // prototype is the VM realm's Object.prototype and a deep-strict compare fails.
    assert.strictEqual(r.totals.error, 0, 'legend reads zero errors, not undefined');
    assert.strictEqual(r.totals.warning, 0, 'legend reads zero warnings');
    assert.strictEqual(r.totals.performance, 0, 'legend reads zero performance');
  });

  test('legend totals tally the charted levels', () => {
    const ctx = buildChartCtx();
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'warning', timestamp: 12_000, viewerLineIndex: 2 },
      { type: 'line', level: 'info', timestamp: 12_500, viewerLineIndex: 3 },   // not a charted level
      { type: 'line', level: 'performance', timestamp: 20_000, viewerLineIndex: 4 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.totals.error, 2, 'both errors counted');
    assert.strictEqual(r.totals.warning, 1, 'the warning counted');
    assert.strictEqual(r.totals.performance, 1, 'the performance line counted');
  });

  test('legend totals exclude events that fell outside the capped window', () => {
    const ctx = buildChartCtx();
    // key 1 is far below the rendered start (key 1000 - 179), so its error must not be counted.
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 5_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', timestamp: 5_000_000, viewerLineIndex: 1 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.totals.error, 1, 'only the in-window error is counted');
  });

  test('setTroubleChartSelection stores a positive timestamp and clears on 0', () => {
    const ctx = buildChartCtx();
    const set = ctx.setTroubleChartSelection as (n: number) => void;
    set(12_345);
    assert.strictEqual(ctx.troubleChartSelectedTs, 12_345, 'selection recorded');
    set(0);
    assert.strictEqual(ctx.troubleChartSelectedTs, 0, 'cleared on rail close');
    set(-1);
    assert.strictEqual(ctx.troubleChartSelectedTs, 0, 'a nonsense timestamp never marks a window');
  });

  test('setTroubleChartInterval clamps to 1..60 seconds', () => {
    const ctx = buildChartCtx();
    const set = ctx.setTroubleChartInterval as (n: number) => void;
    set(0);
    assert.strictEqual(ctx.troubleChartIntervalSec, 1, 'floor at 1s');
    set(100);
    assert.strictEqual(ctx.troubleChartIntervalSec, 60, 'ceiling at 60s');
    set(3);
    assert.strictEqual(ctx.troubleChartIntervalSec, 3, 'valid value kept');
    set(Number.NaN);
    assert.strictEqual(ctx.troubleChartIntervalSec, 3, 'NaN ignored');
  });
});
