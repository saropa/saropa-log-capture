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

  test('a level disabled in enabledLevels is excluded from bars, peak, and totals', () => {
    const ctx = buildChartCtx();
    // The chart honors the same enabledLevels set the toolbar dots / legend chips gate, so a
    // hidden level must not count in the bucket output — not just dim its chip. Error disabled.
    ctx.enabledLevels = new Set(['warning', 'performance']);
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 11_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.totals.error, 0, 'the disabled error level is not counted');
    assert.strictEqual(r.totals.warning, 1, 'the enabled warning still counts');
    assert.strictEqual(r.maxTotal, 1, 'the peak reflects only enabled levels');
    assert.strictEqual(r.bins[0].error, 0, 'no error segment on the bar');
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
  test('the peak count renders in the head AND as the y-axis top scale mark', () => {
    const { ctx, els } = buildChartDomCtx();
    (ctx.renderTroubleChart as () => void)();

    // Head peak (survives collapse) and the plot's y-axis max both name the busiest window's
    // count. The y-axis label is an HTML chip with a background, not SVG text, so a tall bar
    // rising under it stays legible — the reason the label can live over the plot now.
    assert.strictEqual(els['trouble-chart-peak'].textContent, 'viewer.troubleChart.peak:2', 'head peak labels the busiest window');
    assert.ok(els['trouble-chart-body'].innerHTML.includes('class="tc-ymax">2<'), 'y-axis max renders the peak in the plot');
    assert.ok(els['trouble-chart-body'].innerHTML.includes('tc-svg'), 'the plot did render');
  });

  test('a resolved app-start draws the green divider; no boundary draws none', () => {
    // Default items (buildChartDomCtx) have no launch line -> no boundary -> no divider.
    const noBoundary = buildChartDomCtx();
    (noBoundary.ctx.renderTroubleChart as () => void)();
    assert.ok(!noBoundary.els['trouble-chart-body'].innerHTML.includes('tc-app-start'), 'no divider without an app-start');

    // A fresh context whose log carries a launch line: the boundary resolves, the strip trims to
    // the app era, and the green app-start divider is drawn at the left edge. A separate context
    // (not a second render on the first) so the resumable scan starts clean over this log.
    const withLaunch = buildChartDomCtx();
    withLaunch.ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: 'Launching lib\\main.dart on x in debug mode...', timestamp: 15_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 2 },
    ];
    (withLaunch.ctx.renderTroubleChart as () => void)();
    assert.ok(withLaunch.els['trouble-chart-body'].innerHTML.includes('class="tc-app-start"'), 'green app-start divider drawn at the left edge');
  });

  test('every bar carries a full-cell tc-hit target so the whole column is clickable', () => {
    const { ctx, els } = buildChartDomCtx();
    (ctx.renderTroubleChart as () => void)();

    // The colored bar is only ~14px wide; the transparent tc-hit rect spans the full cell so a
    // click anywhere in the column jumps the feed (field report: "bars are unclickable").
    const html = els['trouble-chart-body'].innerHTML;
    assert.ok(html.includes('class="tc-hit"'), 'a full-cell hit rect is drawn');
    assert.ok(html.includes('data-line='), 'and the bar carries the 1-based feed line to jump to');
  });

  test('the x-axis shows several HH:MM ticks, never per-second labels', () => {
    const { ctx, els } = buildChartDomCtx();
    (ctx.renderTroubleChart as () => void)();

    // The axis <span>s are bare (the y-max span carries a class), so counting them counts ticks.
    const html = els['trouble-chart-body'].innerHTML;
    const ticks = (html.match(/<span>/g) || []).length;
    assert.ok(ticks >= 3, 'more than the old two end labels');
    // HH:MM only — a seconds field (a third colon-group) on an axis label is the regression.
    assert.ok(!/<span>\d{2}:\d{2}:\d{2}<\/span>/.test(html), 'axis labels drop the seconds');
    assert.ok(/<span>\d{2}:\d{2}<\/span>/.test(html), 'axis labels are HH:MM');
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

  test('a level disabled in enabledLevels renders its chip dimmed, unpressed, and clickable', () => {
    const { ctx, els } = buildChartDomCtx();
    // enabledLevels is owned by the level-filter script (absent from this VM); inject it to
    // prove the chip render reads it. Error off, warning/performance on.
    ctx.enabledLevels = new Set(['warning', 'performance']);
    (ctx.renderTroubleChart as () => void)();

    const html = els['trouble-chart-legend'].innerHTML;
    // data-level is what the delegated toggleLevel/soloLevel handler reads off the chip.
    assert.match(html, /class="tc-chip tc-chip-error tc-chip-off"[^>]*data-level="error"[^>]*aria-pressed="false"/, 'disabled level: dimmed + unpressed');
    assert.match(html, /class="tc-chip tc-chip-warning"[^>]*data-level="warning"[^>]*aria-pressed="true"/, 'enabled level: active + pressed');
    assert.ok(html.includes('role="button"') && html.includes('tabindex="0"'), 'chips are keyboard-reachable buttons');
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

/** A stub legend chip: only the three surfaces syncTroubleChartChips touches. */
function chipStub(level: string): { attrs: Record<string, string>; classes: Set<string>;
  getAttribute(k: string): string | null; setAttribute(k: string, v: string): void;
  classList: { toggle(c: string, on: boolean): void } } {
  const attrs: Record<string, string> = { 'data-level': level };
  const classes = new Set<string>(['tc-chip', 'tc-chip-' + level]);
  return {
    attrs, classes,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = v; },
    classList: { toggle: (c, on) => { if (on) { classes.add(c); } else { classes.delete(c); } } },
  };
}

suite('Trouble Mode severity chart — chips as level filters', () => {
  test('syncTroubleChartChips dims the chips disabled in enabledLevels, in place', () => {
    const chips = ['error', 'warning', 'performance'].map(chipStub);
    // The legend container: querySelectorAll feeds the chips, addEventListener absorbs the
    // wireTroubleChartChips() delegation the chart IIFE runs at load.
    const legend = { querySelectorAll: () => chips, addEventListener: () => { /* no-op */ } };
    const ctx = vm.createContext({
      console, enabledLevels: new Set(['warning', 'performance']),
      document: { getElementById: (id: string) => (id === 'trouble-chart-legend' ? legend : null) },
    }) as Record<string, unknown>;
    vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'chips.js' });

    (ctx.syncTroubleChartChips as () => void)();

    // Error is not in enabledLevels → dimmed and unpressed; the other two stay active.
    assert.ok(chips[0].classes.has('tc-chip-off'), 'error chip dimmed');
    assert.strictEqual(chips[0].attrs['aria-pressed'], 'false', 'error chip unpressed');
    assert.ok(!chips[1].classes.has('tc-chip-off'), 'warning chip stays lit');
    assert.strictEqual(chips[1].attrs['aria-pressed'], 'true', 'warning chip pressed');
    assert.ok(!chips[2].classes.has('tc-chip-off'), 'performance chip stays lit');
  });
});
