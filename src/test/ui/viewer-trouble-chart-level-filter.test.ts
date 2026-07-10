import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleModeScript } from '../../ui/viewer-search-filter/viewer-trouble-mode';
import { getTroubleChartScript } from '../../ui/viewer-search-filter/viewer-trouble-chart';
import { getLevelFilterScript } from '../../ui/viewer-search-filter/viewer-level-filter';

/**
 * The chart's "totals can never disagree with the feed" fence (viewer-trouble-chart.ts
 * header) previously only held for the level-badge classification, not for the toolbar's
 * enabledLevels toggle: turning a level off hid its lines from the feed but the chart kept
 * counting them, and toggling a level did not rebuild the chart at all. Split into its own
 * sibling file (not appended to viewer-trouble-chart.test.ts, already over the 300-line
 * house limit) per the project's file-splitting convention.
 */

interface Bucket { key: number; error: number; warning: number; performance: number }
interface LevelTotals { error: number; warning: number; performance: number }
interface BucketResult { bins: Bucket[]; maxTotal: number; totals: LevelTotals }

suite('Trouble Mode severity chart — respects the enabledLevels toggle', () => {
  test('a level disabled in enabledLevels is excluded from bins, totals, AND the peak', () => {
    const ctx = vm.createContext({ allLines: [], Number, console }) as Record<string, unknown>;
    vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'chart-levels.js' });
    ctx.enabledLevels = new Set(['error', 'warning']); // performance OFF
    ctx.allLines = [
      // A 4-event performance burst in window key 2 (5s windows: floor(ts/5000)) — if this
      // still counted, it alone would set the peak to 4, dwarfing the real error/warning
      // activity below. Disabling performance must drop the window to an empty gap.
      { type: 'line', level: 'performance', timestamp: 10_000, viewerLineIndex: 0 },
      { type: 'line', level: 'performance', timestamp: 10_100, viewerLineIndex: 1 },
      { type: 'line', level: 'performance', timestamp: 10_200, viewerLineIndex: 2 },
      { type: 'line', level: 'performance', timestamp: 10_300, viewerLineIndex: 3 },
      // window key 4: one error + one warning, both still enabled.
      { type: 'line', level: 'error', timestamp: 20_000, viewerLineIndex: 4 },
      { type: 'line', level: 'warning', timestamp: 20_500, viewerLineIndex: 5 },
    ];

    const r = (ctx.buildTroubleChartBuckets as () => BucketResult)();
    assert.strictEqual(r.totals.performance, 0, 'disabled level contributes nothing to the legend total');
    assert.strictEqual(r.totals.error, 1, 'still-enabled levels keep counting');
    assert.strictEqual(r.totals.warning, 1, 'still-enabled levels keep counting');
    assert.strictEqual(r.bins[0].performance, 0, 'the burst window carries no segment for the disabled level');
    assert.strictEqual(r.maxTotal, 2, 'peak reflects the visible error+warning window, not the hidden 4-event burst');
  });

  test('with no enabledLevels toggle applied (all on), every charted level still counts', () => {
    // Guards the VM-harness fallback (typeof enabledLevels === 'undefined') documented in
    // buildTroubleChartBuckets — the chart must not go blank if the level-filter script is
    // ever absent from the concatenated page.
    const ctx = vm.createContext({ allLines: [], Number, console }) as Record<string, unknown>;
    vm.runInContext(getTroubleModeScript() + getTroubleChartScript(), ctx, { filename: 'chart-levels-default.js' });
    ctx.allLines = [{ type: 'line', level: 'performance', timestamp: 10_000, viewerLineIndex: 0 }];

    const r = (ctx.buildTroubleChartBuckets as () => BucketResult)();
    assert.strictEqual(r.totals.performance, 1, 'no enabledLevels set means nothing is excluded');
  });
});

suite('Trouble Mode severity chart — toggling a level rebuilds the chart', () => {
  /** Combine the real level-filter, trouble-mode, and chart scripts in one VM, stubbing
   *  only the DOM/host bridge each touches (mirrors viewer-level-filter-context-focus.test.ts). */
  function buildWiredCtx(): Record<string, unknown> {
    const domStub = {
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      body: { classList: { toggle: () => undefined } },
    };
    const prelude = /* javascript */ `
var allLines = [];
var contextLinesBefore = 0;
function recalcAndRender() {}
function recalcHeights() {}
function renderViewport() {}
function stripTags(h){return (h==null?'':String(h)).replace(/<[^>]*>/g,'');}
var vscodeApi = { postMessage: function(){}, getState: function(){return {};}, setState: function(){} };
`;
    // scheduleTroubleChartUpdate calls the real setTimeout; the VM has none by default, and
    // the test only needs to prove a rebuild was SCHEDULED, not that it fired 200ms later.
    const ctx = vm.createContext({
      console, document: domStub, window: { addEventListener: () => undefined },
      setTimeout: () => 'scheduled',
    }) as Record<string, unknown>;
    vm.runInContext(
      prelude + getLevelFilterScript() + getTroubleModeScript() + getTroubleChartScript(),
      ctx,
      { filename: 'level-toggle-wiring.js' },
    );
    ctx.troubleModeActive = true; // scheduleTroubleChartUpdate is a no-op while the mode is off
    return ctx;
  }

  test('toggleLevel schedules a chart rebuild (the syncLevelDots choke point)', () => {
    const ctx = buildWiredCtx();
    assert.strictEqual(ctx.troubleChartTimer, null, 'no rebuild scheduled yet');
    (ctx.toggleLevel as (level: string) => void)('performance');
    assert.strictEqual(ctx.troubleChartTimer, 'scheduled', 'turning a level off must schedule a chart rebuild');
  });

  test('soloLevel and selectAllLevels also schedule a rebuild via the same choke point', () => {
    const soloCtx = buildWiredCtx();
    (soloCtx.soloLevel as (level: string) => void)('error');
    assert.strictEqual(soloCtx.troubleChartTimer, 'scheduled', 'soloLevel must schedule a chart rebuild');

    const allCtx = buildWiredCtx();
    (allCtx.selectAllLevels as () => void)();
    assert.strictEqual(allCtx.troubleChartTimer, 'scheduled', 'selectAllLevels must schedule a chart rebuild');
  });

  test('no rebuild is scheduled while Trouble Mode is off', () => {
    const ctx = buildWiredCtx();
    ctx.troubleModeActive = false;
    (ctx.toggleLevel as (level: string) => void)('performance');
    assert.strictEqual(ctx.troubleChartTimer, null, 'scheduleTroubleChartUpdate is a no-op outside Trouble Mode');
  });
});
