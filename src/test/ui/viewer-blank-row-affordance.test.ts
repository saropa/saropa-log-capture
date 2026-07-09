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
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

/**
 * Regression for BUG_Log_viewer_issues.md item 1 — "blanks showing with expander arrows".
 *
 * Blank content rows (empty console output / paragraph-break slivers) render at a
 * quarter-height (> 0), so computeRowAffordances used to accept a blank row as the
 * `prevVis` anchor and stamp the filter-hidden-gap reveal chevron (`_hiddenAfter`) on
 * it — a blank row with an expander arrow. The fix skips blank rows as affordance
 * anchors so the reveal chevron attaches to the nearest NON-blank visible row instead.
 *
 * Builds the real addToData + calcItemHeight + computeRowAffordances pipeline in a VM
 * (no DOM, no vscode) and feeds: a content line, a blank line, a warnplus-hidden device
 * line, then a following visible line.
 */
function vtStub(k: string, ...a: (string | number)[]): string {
  let s = stringsWebview[k] ?? stringsWebviewB[k] ?? k;
  for (let i = 0; i < a.length; i++) { s = s.split('{' + i + '}').join(String(a[i])); }
  return s;
}

function build(): Record<string, unknown> {
  const prelude = /* javascript */ `
var ROW_HEIGHT=20,MARKER_HEIGHT=28,RUN_SEPARATOR_HEIGHT=72;
var allLines=[],totalHeight=0,nextSeq=1,nextGroupId=0,activeGroupHeader=null,groupHeaderMap={};
var sessionStartTs=null,autoHiddenCount=0,strictLevelDetection=false,suppressTransientErrors=false;
var viewerPreserveAsciiBoxArt=true,viewerGroupAsciiArt=false,viewerDetectAsciiArt=false,fileMode='log',isViewingFile=false;
var stackDefaultState=false,stackPreviewCount=3,decoShowCounter=true,decoShowQuality=false;
function areDecorationsOn(){return true;} function getCounterDigitsForLayout(){return 5;}
function calcLevelFiltered(){return false;} var window=globalThis;
function stripTags(h){var s=(h==null?'':String(h)).replace(/<[^>]*>/g,'');return s.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');}
function isStackFrameText(h){var p=stripTags(h),t=p.replace(/^\\s+/,'');if(!t)return false;if(/^\\s+\\S*\\/\\S+\\.\\S+\\s+\\d+:\\d+\\s+\\S/.test(p))return true;return /\\(\\.\\\/\\S+\\.dart:\\d+:\\d+\\)/.test(p);}
function isAsyncGapText(){return false;} function isElidedFramesSummary(){return false;}
function parseClassTags(){return [];} function parseLogcatTag(p){var m=/^([VDIWEFA])\\/([^(:\\s]+)/.exec(p);return m?m[2]:null;}
function parseSourceTag(p){var m=/^\\s*\\[([\\w-]+)\\]/.exec(p);return m?m[1]:null;}
function classifyLevel(){return 'info';} function classifyError(){return null;} function checkCriticalError(){}
function isClassFiltered(){return false;} function calcScopeFiltered(){return false;} function testAutoHide(){return false;}
function finalizeStackGroup(){} function registerClassTags(){} function registerSourceTag(){} function registerSqlPattern(){}
function resetCompressDupStreak(){} function updateCompressDupStreakAfterLine(){} function extractContext(){return null;}
function getQualityBadge(){return '';}
function previousLineLevel(){for(var i=allLines.length-1;i>=0;i--){var it=allLines[i];if(it.type==='marker')return 'info';if(it.level)return it.level;}return 'info';}
`;
  const code = prelude + getNPlusOneDetectorScript(VIEWER_REPEAT_THRESHOLD_DEFAULTS) + getViewerDbDetectorFrameworkScript(true)
    + getSqlDrilldownUiScript() + getViewerDataHelpersCore() + getStackFilterScript() + getViewportRenderScript()
    + getCounterAffordanceScript() + getStackHeaderRenderScript() + getViewerDataAddScript();
  const ctx = vm.createContext({ console, vt: vtStub }) as Record<string, unknown>;
  vm.runInContext(code, ctx, { filename: 'blank-affordance.js', timeout: 10_000 });
  return ctx;
}

// addToData(html, isMarker, category, ts, fw, sp, elapsedMs, qualityPercent, source, rawText, tier)
function add(ctx: Record<string, unknown>, html: string, tier?: string, fw?: boolean, cat = 'console'): void {
  (ctx.addToData as (...a: unknown[]) => void)(
    html, false, cat, 1000, fw, undefined, undefined, undefined, 'debug', null, tier,
  );
}

suite('Blank-row reveal chevron (BUG_Log_viewer_issues item 1)', () => {
  test('a blank row before a hidden gap does NOT host the reveal chevron; the prior content row does', () => {
    const ctx = build();
    add(ctx, '[log] real content line');                              // idx 0 — non-blank, visible
    add(ctx, ' ');                                                    // idx 1 — blank sliver, visible
    add(ctx, 'D/Android: Awesome Notifications event', 'device-other', true, 'stdout'); // idx 2 — hidden (warnplus)
    add(ctx, '[log] next app line');                                 // idx 3 — visible after the gap

    const all = ctx.allLines as Array<Record<string, unknown>>;
    const calc = ctx.calcItemHeight as (x: unknown) => number;
    for (const it of all) { (it as { height: number }).height = calc(it); }
    (ctx.computeRowAffordances as () => void)();

    const blank = all.find((it) => it.type === 'line' && String(it.html).trim() === '');
    assert.ok(blank, 'blank row present');
    assert.ok((calc(blank) as number) > 0, 'blank row renders at quarter height (visible, not filtered out)');
    assert.ok(!blank!._hiddenAfter, 'blank row must NOT carry the reveal chevron');

    const content = all.find((it) => String(it.html).includes('real content line'));
    assert.ok(content, 'content row present');
    assert.ok(content!._hiddenAfter, 'the nearest non-blank row hosts the reveal chevron instead');
    assert.strictEqual((content!._hiddenAfter as { count: number }).count, 1, 'one hidden device line in the gap');
  });

  test('a blank row alone between two visible rows produces no reveal chevron', () => {
    const ctx = build();
    add(ctx, '[log] line A');   // idx 0
    add(ctx, ' ');              // idx 1 — blank, nothing hidden
    add(ctx, '[log] line B');   // idx 2
    const all = ctx.allLines as Array<Record<string, unknown>>;
    const calc = ctx.calcItemHeight as (x: unknown) => number;
    for (const it of all) { (it as { height: number }).height = calc(it); }
    (ctx.computeRowAffordances as () => void)();
    for (const it of all) {
      assert.ok(!it._hiddenAfter, 'no row should carry _hiddenAfter when only a blank separates content');
    }
  });
});
