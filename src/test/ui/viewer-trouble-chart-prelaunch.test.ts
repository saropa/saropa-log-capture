import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleModeScript } from '../../ui/viewer-search-filter/viewer-trouble-mode';
import { getTroubleChartScript } from '../../ui/viewer-search-filter/viewer-trouble-chart';

/**
 * Trouble Mode severity chart — the pre-app device-burst boundary (buildTroubleChartBuckets +
 * troubleChartLaunchTs). Split out of viewer-trouble-chart.test.ts to hold the test-file line cap;
 * shares no state with it.
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

suite('Trouble Mode severity chart — the pre-app device burst', () => {
  // A phone drains its logcat backlog while an app starts: dozens of framework warnings that
  // belong to the device, not the app. Rather than draw that burst muted, the chart DROPS every
  // window before the app-ready boundary and starts at the first real event — no dominating
  // spike, and no long empty gap between the burst and app start. Excluding those lines from the
  // FEED is the opt-in warm-up filter's job, not this chart's.
  const LAUNCH = 'Launching lib\\main.dart on motorola edge 2022 in debug mode...';

  test('windows before the launch line are dropped; the chart starts at the first real event', () => {
    const ctx = buildChartCtx();
    // 5s windows. Window 2 (10_000..14_999) holds a 3-warning burst; launch lands in window 3,
    // so window 2 is pre-app and dropped entirely — the chart begins at the window-4 error.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'warning', timestamp: 12_000, viewerLineIndex: 2 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 15_000, viewerLineIndex: 3 },
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 4 },
    ];

    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1, 'only the app-era window is charted, no leading gap');
    assert.strictEqual(r.bins[0].key, 4, 'and it is the window holding the error');
    assert.strictEqual(r.maxTotal, 1, 'the burst does not set the scale');
    assert.strictEqual(r.totals.warning, 0, 'the dropped burst is not counted in the totals');
    assert.strictEqual(r.totals.error, 1, 'the app-era error is');
  });

  test('the window containing the launch line is kept (it holds app-era events too)', () => {
    const ctx = buildChartCtx();
    // The launch line sits inside window 2, whose end is after the boundary, so it is real.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 12_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1, 'the mixed window is not dropped');
    assert.strictEqual(r.maxTotal, 2, 'so it sets the scale');
  });

  test('a log with no launch line charts everything', () => {
    const ctx = buildChartCtx();
    // A pure logcat capture, or a session attached after the app was already running: with no
    // boundary nothing is pre-app, so the whole span shows.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.maxTotal, 2, 'no launch line means no exclusion');
    assert.strictEqual(r.bins[0].key, 2, 'and the chart starts at the first event');
  });

  test('when only pre-app events exist, the chart is empty rather than showing the burst', () => {
    const ctx = buildChartCtx();
    // Boundary is later than every event so far — the app has not produced trouble yet. The
    // chart shows its empty state instead of scaling to the device burst.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 30_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 0, 'nothing app-era yet, so no bars');
    assert.strictEqual(r.maxTotal, 0, 'and no peak');
  });

  test('an untimestamped launch line takes its instant from the next timestamped line', () => {
    const ctx = buildChartCtx();
    // Flutter prints the launch line to stdout with no clock prefix, so it reaches the page
    // with timestamp 0. The instant comes from the first timestamped line at or after it.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 0, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 16_000, viewerLineIndex: 2 },
    ];
    assert.strictEqual((ctx.troubleChartLaunchTs as () => number)(), 16_000, 'launch instant resolved forward');

    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1, 'the pre-app warning window is dropped');
    assert.strictEqual(r.bins[0].error, 1, 'the chart starts at the app-era error');
    assert.strictEqual(r.maxTotal, 1, 'which sets the peak');
  });

  test('a launch line still streaming has no instant yet, and charts everything', () => {
    const ctx = buildChartCtx();
    // Live capture: the launch line has arrived but nothing timestamped has followed it, so the
    // boundary is unresolved and nothing is treated as pre-app.
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 0, viewerLineIndex: 1 },
    ];
    assert.strictEqual((ctx.troubleChartLaunchTs as () => number)(), 0, 'unresolved, not guessed');
    const r = buckets(ctx);
    assert.strictEqual(r.bins.length, 1, 'the warning window still shows');
    assert.strictEqual(r.maxTotal, 1, 'nothing excluded');
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

  test('prefers the build-complete line over the earlier launch line', () => {
    const ctx = buildChartCtx();
    // "Launching…" prints at 15s, the apk finishes building at 25s. Nothing the app emits can
    // precede its own built artifact, so the whole build phase — including any device noise
    // between the two — is device backlog. The boundary must be the build line, not launch.
    const BUILT = '√ Built build\\app\\outputs\\flutter-apk\\app-debug.apk';
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 15_000, viewerLineIndex: 1 },
      { type: 'line', level: 'warning', timestamp: 20_000, viewerLineIndex: 2 },
      { type: 'line', level: 'info', rawText: BUILT, timestamp: 25_000, viewerLineIndex: 3 },
      { type: 'line', level: 'error', timestamp: 30_000, viewerLineIndex: 4 },
    ];
    assert.strictEqual((ctx.troubleChartLaunchTs as () => number)(), 25_000, 'boundary is the build line');

    const r = buckets(ctx);
    // Both the pre-launch warning (window 2) and the during-build warning (window 4) are before
    // the 25s boundary, so both are dropped; the chart begins at the post-build error (window 6).
    assert.strictEqual(r.bins.length, 1, 'only the post-build window is charted');
    assert.strictEqual(r.bins[0].key, 6, 'the chart starts at the post-build error');
    assert.strictEqual(r.totals.warning, 0, 'neither warning window is counted');
    assert.strictEqual(r.maxTotal, 1, 'only the post-build error sets the peak');
  });

  test('device backlog charts normally before app start, and flags no app-start yet', () => {
    const ctx = buildChartCtx();
    // The phone dumps its logcat backlog at session start, BEFORE the launch line arrives, so
    // the boundary is still 0. The chart shows that burst rather than an empty hold — a blank
    // chart would hide real pre-startup issues. No boundary yet means no app-start divider.
    ctx.allLines = [
      { type: 'line', level: 'warning', category: 'logcat', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', category: 'logcat', timestamp: 11_000, viewerLineIndex: 1 },
    ];
    const r = buckets(ctx) as BucketResult & { atAppStart?: boolean };
    assert.ok(r.bins.length > 0, 'the pre-app burst still charts (nothing is hidden)');
    assert.strictEqual(r.totals.error, 1, 'and its events count');
    assert.notStrictEqual(r.atAppStart, true, 'no boundary yet, so no app-start divider');
  });

  test('the launch line resets the start to the app era and flags the app-start divider', () => {
    const ctx = buildChartCtx();
    // The real shape: logcat backlog, then the launch line, then an app-era error. The boundary
    // resolves, the pre-launch backlog window is dropped, and the app-start divider is flagged.
    ctx.allLines = [
      { type: 'line', level: 'warning', category: 'logcat', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'warning', category: 'logcat', timestamp: 11_000, viewerLineIndex: 1 },
      { type: 'line', level: 'info', rawText: LAUNCH, category: 'console', timestamp: 15_000, viewerLineIndex: 2 },
      { type: 'line', level: 'error', category: 'logcat', timestamp: 20_000, viewerLineIndex: 3 },
    ];
    const r = buckets(ctx) as BucketResult & { atAppStart?: boolean };
    assert.strictEqual(r.totals.warning, 0, 'the pre-launch backlog window is dropped');
    assert.strictEqual(r.totals.error, 1, 'only the app-era error charts');
    assert.strictEqual(r.atAppStart, true, 'the app-start divider is flagged');
  });

  test('does NOT flag the app-start divider when the cap trims the start past the app era', () => {
    const ctx = buildChartCtx();
    // Launch resolves the boundary, but the app-era span is longer than TROUBLE_CHART_MAX_BUCKETS
    // (180 windows), so the cap pushes start well past the real first window. bins[0] is then a
    // mid-session window, NOT app start — the green divider must not claim it is.
    ctx.allLines = [
      { type: 'line', level: 'info', rawText: LAUNCH, category: 'console', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', category: 'logcat', timestamp: 20_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', category: 'logcat', timestamp: 20_000 + 200 * 5_000, viewerLineIndex: 2 },
    ];
    const r = buckets(ctx) as BucketResult & { atAppStart?: boolean };
    assert.strictEqual(r.bins.length, 180, 'the strip is capped to the most-recent 180 windows');
    assert.strictEqual(r.atAppStart, false, 'a capped mid-session left edge is not marked as app start');
  });

  test('a single error renders a taller floor than warning/performance so it stays visible', () => {
    const ctx = buildChartCtx();
    // troubleChartStackRects clamps error to TROUBLE_CHART_MIN_ERROR (5) and warning/perf to
    // TROUBLE_CHART_MIN_BAR (3); with a tiny scale both clamp, so error draws taller.
    const rects = (ctx.troubleChartStackRects as (b: unknown, g: unknown, s: number) => string)(
      { error: 1, warning: 1, performance: 0 },
      { barX: 0, barW: 10, cellX: 0, cellW: 14 },
      0.1,
    );
    assert.match(rects, /class="tc-bar-error"[^>]*height="5\.0"/, 'a lone error clamps to the 5px floor');
    assert.match(rects, /class="tc-bar-warning"[^>]*height="3\.0"/, 'warning keeps the 3px floor');
  });

  test('self-heals when a new log replaces the array without a reset', () => {
    const ctx = buildChartCtx();
    ctx.allLines = [
      { type: 'line', level: 'warning', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'info', rawText: LAUNCH, timestamp: 15_000, viewerLineIndex: 1 },
    ];
    const launchTs = ctx.troubleChartLaunchTs as () => number;
    assert.strictEqual(launchTs(), 15_000, 'first log resolves its launch');

    // A different log swapped in WITHOUT calling resetTroubleChartLaunchScan — the load path
    // that produced the 9.2.0 field report where the device burst kept scaling the peak. The
    // cached marker index (1) now points at unrelated content, so the scan restarts itself.
    ctx.allLines = [
      { type: 'line', level: 'error', timestamp: 90_000, viewerLineIndex: 0 },
      { type: 'line', level: 'error', timestamp: 91_000, viewerLineIndex: 1 },
      { type: 'line', level: 'error', timestamp: 92_000, viewerLineIndex: 2 },
    ];
    assert.strictEqual(launchTs(), 0, 'no stale launch carried over from the previous log');
  });
});
