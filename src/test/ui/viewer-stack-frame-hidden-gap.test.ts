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
 * Regression for the "collapse swallows unrelated lines" report (2026-06-07).
 *
 * Device-tier lines default to `showDevice='warnplus'`, so an info-level device
 * line (logcat, Awesome Notifications, …) that falls immediately AFTER an app
 * stack trace is hidden. computeRowAffordances stamps the reveal `_hiddenAfter`
 * on the LAST stack-frame of that trace — but stack-frame rows historically
 * suppressed their decoration prefix, so the chevron was thrown away and the
 * hidden line vanished with no control to surface it. renderStackFrame now
 * renders the affordance chevron (empty counter — frames have no line number)
 * for the stack-frame + _hiddenAfter case, dropping the alignment spacer so the
 * column stays put.
 *
 * This builds the real addToData + affordance + renderStackFrame pipeline in a
 * VM (no DOM, no vscode) and feeds a synthetic app trace followed by a hidden
 * device line.
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
  vm.runInContext(code, ctx, { filename: 'gap.js', timeout: 10_000 });
  return ctx;
}

suite('Stack-frame reveal chevron for a hidden device gap', () => {
  test('last frame before a warnplus-hidden device line renders a gap reveal chevron', () => {
    const ctx = build();
    const add = ctx.addToData as (...a: unknown[]) => void;
    // app message, two app frames (one trace), then an info-level device line.
    add('[log] Notification Sent', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    add('      ./lib/a.dart 10:1  A.one', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    add('      ./lib/b.dart 20:2  B.two', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    // device-other info line — hidden by default warnplus.
    add('D/Android: Awesome Notifications event', false, 'stdout', 1100, true, undefined, undefined, undefined, 'debug', null, 'device-other');
    add('[log] next app line', false, 'console', 1200, undefined, undefined, undefined, undefined, 'debug', null, undefined);

    const all = ctx.allLines as Array<Record<string, unknown>>;
    const calc = ctx.calcItemHeight as (x: unknown) => number;
    for (const it of all) { (it as { height: number }).height = calc(it); }
    (ctx.computeRowAffordances as () => void)();

    // The device line must be hidden by the warnplus default...
    const dev = all.find((it) => String(it.html).includes('Awesome Notifications'));
    assert.ok(dev, 'device line present');
    assert.strictEqual(calc(dev), 0, 'device info line hidden by default warnplus');

    // ...and the last frame must host the reveal gap.
    let frameIdx = -1;
    for (let i = 0; i < all.length; i++) {
      if (all[i].type === 'stack-frame' && all[i]._hiddenAfter) { frameIdx = i; }
    }
    assert.ok(frameIdx >= 0, 'a stack-frame carries _hiddenAfter for the hidden gap');

    const renderStackFrame = ctx.renderStackFrame as (...a: unknown[]) => string;
    const out = renderStackFrame(all[frameIdx], frameIdx, all[frameIdx].html, '', '', ' data-idx="' + frameIdx + '"', '');
    assert.ok(out.includes('deco-counter-row'), 'frame renders a clickable counter-row');
    assert.ok(out.includes('data-affordance-kind="gap"'), 'with a gap reveal affordance');
    assert.ok(out.includes('data-hidden-from'), 'carrying the hidden range for the peek handler');
    assert.ok(!out.includes('line-deco-spacer-only'), 'alignment spacer dropped when the gutter is present');
  });

  test('a frame with no hidden gap still renders no decoration (spacer only)', () => {
    const ctx = build();
    const add = ctx.addToData as (...a: unknown[]) => void;
    add('[log] msg', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    add('      ./lib/a.dart 10:1  A.one', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    add('      ./lib/b.dart 20:2  B.two', false, 'console', 1000, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    add('[log] next', false, 'console', 1200, undefined, undefined, undefined, undefined, 'debug', null, undefined);
    const all = ctx.allLines as Array<Record<string, unknown>>;
    const calc = ctx.calcItemHeight as (x: unknown) => number;
    for (const it of all) { (it as { height: number }).height = calc(it); }
    (ctx.computeRowAffordances as () => void)();
    const frame = all.filter((it) => it.type === 'stack-frame').pop()!;
    const idx = all.indexOf(frame);
    const renderStackFrame = ctx.renderStackFrame as (...a: unknown[]) => string;
    const out = renderStackFrame(frame, idx, frame.html, '', '', ' data-idx="' + idx + '"', '');
    assert.ok(!out.includes('data-affordance-kind'), 'no reveal chevron when nothing is hidden after the frame');
    /* Plan 055 Phase 2: a no-gap frame carries NO decoration cell — it nests in the
       message track via the grid, so there is no alignment spacer to keep in sync. */
    assert.ok(!out.includes('line-decoration'), 'no decoration cell when nothing is hidden after the frame');
  });
});
