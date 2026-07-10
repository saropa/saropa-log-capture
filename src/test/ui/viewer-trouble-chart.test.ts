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

interface Bucket { key: number; error: number; warning: number; performance: number; firstLine: number | null; preLaunch: boolean }
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

suite('Trouble Mode severity chart — the pre-launch device burst', () => {
  // A phone drains its logcat backlog while an app starts: dozens of framework warnings
  // that belong to the device, not the app. Left in the peak, that one window scales the
  // whole strip and every real spike after it collapses to a sliver.
  const LAUNCH = 'Launching lib\\main.dart on motorola edge 2022 in debug mode...';

  test('a window ending before the launch line is excluded from the peak', () => {
    const ctx = buildChartCtx();
    // 5s windows. Window 2 (10_000..14_999) holds a 3-warning burst; launch lands in
    // window 3, so window 2 ends before it and only the single later error sets the peak.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'warning', timestamp: 12_000, viewerLineIndex: 2 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 15_000, viewerLineIndex: 3 },
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 4 },
    ];

    const r = buckets(ctx);
    assert.strictEqual(r.maxTotal, 1, 'the burst does not set the scale');
    assert.strictEqual(r.bins[0].preLaunch, true, 'burst window flagged pre-launch');
    assert.strictEqual(r.bins[0].warning, 3, 'and its bar still carries all three warnings');
    assert.strictEqual(r.bins[2].preLaunch, false, 'the app-era window is not flagged');
    assert.strictEqual(r.totals.warning, 3, 'the legend still counts them — nothing is hidden');
  });

  test('the window containing the launch line counts toward the peak', () => {
    const ctx = buildChartCtx();
    // The launch line sits inside window 2, which therefore holds app-era events too.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 12_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins[0].preLaunch, false, 'a mixed window is never treated as device noise');
    assert.strictEqual(r.maxTotal, 2, 'so it sets the scale');
  });

  test('a log with no launch line scales to everything', () => {
    const ctx = buildChartCtx();
    // A pure logcat capture, or a session attached after the app was already running.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.maxTotal, 2, 'no launch line means no exclusion');
    assert.strictEqual(r.bins[0].preLaunch, false, 'nothing is flagged');
  });

  test('when nothing has happened since launch, the burst scales the chart', () => {
    const ctx = buildChartCtx();
    // Otherwise every bar would divide by a zero peak and vanish.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 30_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins[0].preLaunch, true, 'the burst is still flagged');
    assert.strictEqual(r.maxTotal, 2, 'but the peak falls back to it rather than 0');
  });

  test('an untimestamped launch line takes its instant from the next timestamped line', () => {
    const ctx = buildChartCtx();
    // This is the real shape: Flutter prints the launch line to stdout with no clock
    // prefix, so it reaches the page with timestamp 0. Requiring a timestamp on the line
    // itself would disable the rule for every log it exists to fix.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 0, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 16_000, viewerLineIndex: 2 },
    ];
    assert.strictEqual((ctx.troubleChartLaunchTs as () => number)(), 16_000, 'launch instant resolved forward');

    const r = buckets(ctx);
    assert.strictEqual(r.bins[0].preLaunch, true, 'the warning window ends before it');
    assert.strictEqual(r.maxTotal, 1, 'and only the app-era error sets the peak');
  });

  test('a launch line still streaming has no instant yet, and excludes nothing', () => {
    const ctx = buildChartCtx();
    // Live capture: the launch line has arrived but nothing timestamped has followed it.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 0, viewerLineIndex: 1 },
    ];
    assert.strictEqual((ctx.troubleChartLaunchTs as () => number)(), 0, 'unresolved, not guessed');
    assert.strictEqual(buckets(ctx).bins[0].preLaunch, false, 'so nothing is muted');
  });

  test('loading a new log restarts the resumable scan', () => {
    const ctx = buildChartCtx();
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 15_000, viewerLineIndex: 1 },
    ];
    const launchTs = ctx.troubleChartLaunchTs as () => number;
    assert.strictEqual(launchTs(), 15_000, 'launch timestamp found');

    // A longer log with no launch line: without the explicit reset the scan would resume
    // past index 1 and keep reporting the previous log's launch.
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 90_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', timestamp: 91_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 92_000, viewerLineIndex: 2 },
    ];
    (ctx.resetTroubleChartLaunchScan as () => void)();
    assert.strictEqual(launchTs(), 0, 'no stale launch from the previous log');
  });
});

/** The subset of an element the chart's head/plot rendering touches. */
interface ChartStubEl {
  innerHTML: string;
  textContent: string;
  attrs: Record<string, string>;
  classes: Set<string>;
  classList: { toggle(c: string, on: boolean): void; contains(c: string): boolean };
  setAttribute(k: string, v: string): void;
  addEventListener(): void;
}

function chartStubEl(): ChartStubEl {
  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  return {
    innerHTML: '', textContent: '', attrs, classes,
    classList: {
      toggle: (c, on) => { if (on) { classes.add(c); } else { classes.delete(c); } },
      contains: (c) => classes.has(c),
    },
    setAttribute: (k, v) => { attrs[k] = v; },
    addEventListener: () => { /* the chevron/bar listeners are exercised by calling the fns directly */ },
  };
}

/** Chart context with a stub document, so the render path (not just the math) runs. */
function buildChartDomCtx(): { ctx: Record<string, unknown>; els: Record<string, ChartStubEl> } {
  const ids = ['trouble-chart', 'trouble-chart-toggle', 'trouble-chart-body', 'trouble-chart-legend', 'trouble-chart-peak'];
  const els: Record<string, ChartStubEl> = {};
  for (const id of ids) { els[id] = chartStubEl(); }
  const ctx = vm.createContext({
    allLines: [], Number, console, Math,
    // Templates are irrelevant here; the assertions read placement, not wording.
    vt: (key: string, ...args: unknown[]) => key + ':' + args.join(','),
    document: { getElementById: (id: string) => els[id] ?? null },
  }) as Record<string, unknown>;
  vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'trouble-chart-dom.js' });
  ctx.troubleModeActive = true;
  ctx.allLines = [
    { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
    { type: 'line', level: 'warning', timestamp: 10_500, viewerLineIndex: 1 },
    { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 2 },
  ];
  return { ctx, els };
}

suite('Trouble Mode severity chart — head placement and collapse', () => {
  test('the peak count renders in the head, never inside the plot', () => {
    const { ctx, els } = buildChartDomCtx();
    (ctx.renderTroubleChart as () => void)();

    // The device-startup warning rush is always the tallest bar and always lands in the
    // leading window, so a peak label drawn inside the plot is drawn underneath it.
    assert.strictEqual(els['trouble-chart-peak'].textContent, 'viewer.troubleChart.peak:2', 'peak labels the busiest window');
    assert.ok(!els['trouble-chart-body'].innerHTML.includes('tc-ymax'), 'no peak label overlays the plot');
    assert.ok(els['trouble-chart-body'].innerHTML.includes('tc-svg'), 'the plot did render');
  });

  test('an empty chart clears the head rather than stranding a stale peak', () => {
    const { ctx, els } = buildChartDomCtx();
    (ctx.renderTroubleChart as () => void)();
    ctx.allLines = [];
    (ctx.renderTroubleChart as () => void)();

    assert.strictEqual(els['trouble-chart-peak'].textContent, '', 'peak cleared');
    assert.strictEqual(els['trouble-chart-legend'].innerHTML, '', 'legend cleared');
    assert.ok(els['trouble-chart-body'].innerHTML.includes('tc-empty'), 'empty state shown');
  });

  test('collapsing keeps the head totals live and skips the plot; expanding rebuilds it', () => {
    const { ctx, els } = buildChartDomCtx();
    const toggle = ctx.toggleTroubleChartCollapsed as () => void;
    const render = ctx.renderTroubleChart as () => void;
    render();

    toggle();
    assert.ok(els['trouble-chart'].classList.contains('tc-collapsed'), 'pane marked collapsed');
    assert.strictEqual(els['trouble-chart-toggle'].attrs['aria-expanded'], 'false', 'chevron reports collapsed');

    // While collapsed, a new line still updates the legend and peak — that is the reason
    // to collapse rather than hide — but must not pay to rebuild the hidden plot.
    (ctx.allLines as unknown[]).push({ type: 'line', level: 'error', timestamp: 20_500, viewerLineIndex: 3 });
    els['trouble-chart-body'].innerHTML = 'STALE';
    render();
    assert.strictEqual(els['trouble-chart-body'].innerHTML, 'STALE', 'hidden plot not rebuilt');
    assert.ok(els['trouble-chart-legend'].innerHTML.includes('legend.error:2'), 'legend still counts the new error');

    // Expanding must rebuild: every render while collapsed left the plot stale.
    toggle();
    assert.ok(!els['trouble-chart'].classList.contains('tc-collapsed'), 'pane expanded');
    assert.strictEqual(els['trouble-chart-toggle'].attrs['aria-expanded'], 'true', 'chevron reports expanded');
    assert.ok(els['trouble-chart-body'].innerHTML.includes('tc-svg'), 'plot rebuilt on expand');
  });
});
