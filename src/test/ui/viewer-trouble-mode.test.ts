import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { stringsWebview } from '../../l10n/strings-webview';
import { stringsWebviewB } from '../../l10n/strings-webview-b';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getStackHeaderRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { getSqlDrilldownUiScript } from '../../ui/viewer/viewer-data-sql-drilldown-ui';
import { getViewerDbDetectorFrameworkScript } from '../../ui/viewer/viewer-db-detector-framework-script';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getCounterAffordanceScript } from '../../ui/viewer/viewer-data-divider';
import { getStackFilterScript } from '../../ui/viewer-stack-tags/viewer-stack-filter';
import { getTroubleModeScript } from '../../ui/viewer-search-filter/viewer-trouble-mode';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

/**
 * Trouble Mode — the zero-context triage filter.
 *
 * Two contracts are pinned:
 *  1. The classifier (calcTroubleFiltered) and apply pass (applyTroubleFilter):
 *     only error/warning/performance survive; database/todo/info/debug/notice are
 *     hidden; markers are NEVER filtered (they carry db-signal / run separators).
 *  2. The birth-height contract: a line arriving while the mode is active is born
 *     at height 0 through the real addToData → computeLineBirthHeight → calcItemHeight
 *     pipeline, not flashing full-height until the next recalc.
 */
function vtStub(k: string, ...a: (string | number)[]): string {
  let s = stringsWebview[k] ?? stringsWebviewB[k] ?? k;
  for (let i = 0; i < a.length; i++) { s = s.split('{' + i + '}').join(String(a[i])); }
  return s;
}

/** Minimal VM for the pure classifier + apply pass (no DOM, no addToData). */
function buildUnit(): Record<string, unknown> {
  const ctx = vm.createContext({ allLines: [] }) as Record<string, unknown>;
  vm.runInContext(getTroubleModeScript(), ctx, { filename: 'trouble-mode.js' });
  return ctx;
}

/**
 * Full addToData + calcItemHeight pipeline in a VM (mirrors
 * viewer-blank-row-affordance.test.ts), plus the Trouble Mode script. classifyLevel
 * is stubbed to discriminate by a leading token so lines get distinct levels.
 */
function buildPipeline(): Record<string, unknown> {
  const prelude = /* javascript */ `
var ROW_HEIGHT=20,MARKER_HEIGHT=28,RUN_SEPARATOR_HEIGHT=72;
var allLines=[],totalHeight=0,nextSeq=1,nextGroupId=0,activeGroupHeader=null,groupHeaderMap={};
var sessionStartTs=null,autoHiddenCount=0,strictLevelDetection=false,suppressTransientErrors=false;
var viewerPreserveAsciiBoxArt=true,viewerGroupAsciiArt=false,viewerDetectAsciiArt=false,fileMode='log',isViewingFile=false;
var stackDefaultState=false,stackPreviewCount=3,decoShowCounter=true,decoShowQuality=false;
function areDecorationsOn(){return true;} function getCounterDigitsForLayout(){return 5;}
function calcLevelFiltered(){return false;} var window=globalThis;
function stripTags(h){var s=(h==null?'':String(h)).replace(/<[^>]*>/g,'');return s.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');}
function isStackFrameText(){return false;}
function isAsyncGapText(){return false;} function isElidedFramesSummary(){return false;}
function parseClassTags(){return [];} function parseLogcatTag(){return null;}
function parseSourceTag(){return null;}
/* Discriminate level by a leading token so the test can build mixed-severity lines. */
function classifyLevel(plain){
  if(/^ERR/.test(plain))return 'error';
  if(/^WARN/.test(plain))return 'warning';
  if(/^PERF/.test(plain))return 'performance';
  return 'info';
}
function classifyError(){return null;} function checkCriticalError(){}
function isClassFiltered(){return false;} function calcScopeFiltered(){return false;} function testAutoHide(){return false;}
function finalizeStackGroup(){} function registerClassTags(){} function registerSourceTag(){} function registerSqlPattern(){}
function resetCompressDupStreak(){} function updateCompressDupStreakAfterLine(){} function extractContext(){return null;}
function getQualityBadge(){return '';}
function previousLineLevel(){return 'info';}
`;
  const code = prelude + getNPlusOneDetectorScript(VIEWER_REPEAT_THRESHOLD_DEFAULTS) + getViewerDbDetectorFrameworkScript(true)
    + getSqlDrilldownUiScript() + getViewerDataHelpersCore() + getStackFilterScript() + getViewportRenderScript()
    + getCounterAffordanceScript() + getStackHeaderRenderScript() + getViewerDataAddScript() + getTroubleModeScript();
  const ctx = vm.createContext({ console, vt: vtStub }) as Record<string, unknown>;
  vm.runInContext(code, ctx, { filename: 'trouble-pipeline.js', timeout: 10_000 });
  return ctx;
}

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function add(ctx: Record<string, unknown>, html: string, isMarker = false): void {
  (ctx.addToData as (...a: unknown[]) => void)(
    html, isMarker, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined,
  );
}

suite('Trouble Mode zero-context filter', () => {
  test('calcTroubleFiltered: off keeps everything; on keeps only error/warning/performance', () => {
    const ctx = buildUnit();
    const calc = (l: string): boolean => (ctx.calcTroubleFiltered as (l: string) => boolean)(l);

    // Mode off: nothing is trouble-filtered.
    for (const lvl of ['info', 'error', 'warning', 'performance', 'database', 'todo', 'debug', 'notice']) {
      assert.strictEqual(calc(lvl), false, lvl + ' must not be filtered when Trouble Mode is off');
    }

    ctx.troubleModeActive = true;
    assert.strictEqual(calc('error'), false, 'error survives');
    assert.strictEqual(calc('warning'), false, 'warning survives');
    assert.strictEqual(calc('performance'), false, 'performance survives');
    assert.strictEqual(calc('info'), true, 'info is hidden');
    assert.strictEqual(calc('debug'), true, 'debug is hidden');
    assert.strictEqual(calc('notice'), true, 'notice is hidden');
    assert.strictEqual(calc('database'), true, 'database is hidden (Drift SQL would drown the feed)');
    assert.strictEqual(calc('todo'), true, 'todo is hidden');
  });

  test('applyTroubleFilter sets flags on lines and NEVER filters markers', () => {
    const ctx = buildUnit();
    ctx.allLines = [
      { type: 'line', level: 'error' },
      { type: 'line', level: 'info' },
      { type: 'line', level: 'performance' },
      { type: 'marker', level: 'info' },
    ];
    ctx.troubleModeActive = true;
    (ctx.applyTroubleFilter as () => void)();
    const lines = ctx.allLines as Array<Record<string, unknown>>;
    assert.strictEqual(lines[0].troubleFiltered, false, 'error line stays visible');
    assert.strictEqual(lines[1].troubleFiltered, true, 'info line is hidden');
    assert.strictEqual(lines[2].troubleFiltered, false, 'performance line stays visible');
    assert.strictEqual(lines[3].troubleFiltered, false, 'marker is never filtered');

    // Toggling off clears every flag.
    ctx.troubleModeActive = false;
    (ctx.applyTroubleFilter as () => void)();
    for (const it of lines) { assert.strictEqual(it.troubleFiltered, false, 'all flags cleared when mode off'); }
  });

  test('birth height: a nominal line arriving under active Trouble Mode is born at height 0', () => {
    const ctx = buildPipeline();
    ctx.troubleModeActive = true;

    add(ctx, 'ERR database connection refused'); // error → visible
    add(ctx, 'plain nominal chatter');           // info  → hidden at birth
    add(ctx, 'PERF slow frame 42ms');            // performance → visible

    const all = ctx.allLines as Array<Record<string, unknown>>;
    const calc = ctx.calcItemHeight as (x: unknown) => number;

    const err = all.find((it) => String(it.html).includes('connection refused'));
    const info = all.find((it) => String(it.html).includes('nominal chatter'));
    const perf = all.find((it) => String(it.html).includes('slow frame'));

    assert.ok(err && info && perf, 'all three lines ingested');
    assert.strictEqual(info!.troubleFiltered, true, 'nominal line born trouble-filtered');
    assert.strictEqual(calc(info), 0, 'nominal line born at height 0 (no full-height flash)');
    assert.ok((calc(err) as number) > 0, 'error line renders');
    assert.ok((calc(perf) as number) > 0, 'performance line renders');
  });
});
