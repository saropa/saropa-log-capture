/**
 * Sandbox for stack-header repeat tests (bug_003). Mirrors
 * viewer-sql-repeat-compression-sandbox.ts shape, but swaps the `isStackFrameText`
 * stub for a real classifier so the stack-frame branch in `addToData` executes.
 *
 * Minimal classifier: matches Dart-style `(./path.dart:line:col)` anywhere in the
 * text. This covers the Drift interceptor lines that motivated the bug
 * (`DriftDebugInterceptor._log (./lib/.../drift_debug_interceptor.dart:92:5)`) and
 * avoids dragging in the full `isStackFrameText` which pulls ASCII box-art
 * detection and other noise irrelevant to repeat-merge testing.
 */
import * as vm from 'node:vm';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getSqlDrilldownUiScript } from '../../ui/viewer/viewer-data-sql-drilldown-ui';
import { getViewerDbDetectorFrameworkScript } from '../../ui/viewer/viewer-db-detector-framework-script';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

export interface StackItemVm {
    type: string;
    html?: string;
    height: number;
    level?: string;
    repeatHidden?: boolean;
    collapsed?: boolean | string;
    stackHdrRepeat?: boolean;
    frameCount?: number;
    groupId?: number;
}

export interface StackSandboxVm {
    addToData: (...args: unknown[]) => void;
    allLines: StackItemVm[];
    totalHeight: number;
    /* Exposed for tests: in the real Drift pattern, SQL lines between stack-headers
       null activeGroupHeader via the non-frame path while leaving the stack-header
       tracker intact (SQL's handleRepeatCollapse does not call resetStackHdrRepeatTracker).
       Tests here manipulate activeGroupHeader directly to simulate that boundary
       without dragging in the full SQL fingerprint pipeline. */
    activeGroupHeader: unknown;
    stackHdrRepeatTracker: {
        anchorIdx: number;
        count: number;
        lastTimestamp: number;
        lastRepeatNotificationIdx: number;
    };
    cleanupTrailingRepeats: () => void;
    resetStackHdrRepeatTracker: () => void;
}

function buildSandboxScript(): string {
    return /* javascript */ `
var ROW_HEIGHT = 20;
var MARKER_HEIGHT = 28;
var allLines = [];
var totalHeight = 0;
var nextSeq = 1;
var nextGroupId = 0;
var activeGroupHeader = null;
var groupHeaderMap = {};
var sessionStartTs = null;
var autoHiddenCount = 0;
var strictLevelDetection = false;
var suppressTransientErrors = false;
var viewerPreserveAsciiBoxArt = true;
var viewerGroupAsciiArt = false;
var viewerDetectAsciiArt = false;
var fileMode = 'log';
var showFlutter = 'all';
var showDevice = 'all';
var showExternal = 'all';
var stackDefaultState = false;
var stackPreviewCount = 3;
function isTierHidden() { return false; }
function calcLevelFiltered() { return false; }
var window = globalThis;

function stripTags(html) { var s = (html == null ? '' : String(html)).replace(/<[^>]*>/g, ''); return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }
/* Real classifier scope: Dart source path anchor. Matches the Drift interceptor frame
   shape without the full isStackFrameText complexity. */
function isStackFrameText(html) {
    var plain = stripTags(html);
    return /\\(\\.\\\/\\S+\\.dart:\\d+:\\d+\\)/.test(plain);
}
function parseClassTags() { return []; }
function parseLogcatTag() { return null; }
function parseSourceTag() { return null; }
function classifyLevel() { return 'info'; }
function classifyError() { return null; }
function checkCriticalError() {}
function isClassFiltered() { return false; }
function calcScopeFiltered() { return false; }
function testAutoHide() { return false; }
function finalizeStackGroup() {}
function registerClassTags() {}
function registerSourceTag() {}
function registerSqlPattern() {}
function resetCompressDupStreak() {}
function updateCompressDupStreakAfterLine() {}
function extractContext() { return null; }
function previousLineLevel() {
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (it.type === 'marker' || it.type === 'run-separator') return 'info';
        if (it.level) return it.level;
    }
    return 'info';
}

function recalcHeights() {
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].height = calcItemHeight(allLines[i]);
        totalHeight += allLines[i].height;
    }
}
function renderViewport() {}
`;
}

export function loadStackHeaderRepeatSandbox(): StackSandboxVm {
    const code =
        buildSandboxScript() +
        getNPlusOneDetectorScript(VIEWER_REPEAT_THRESHOLD_DEFAULTS) +
        getViewerDbDetectorFrameworkScript(false) +
        getSqlDrilldownUiScript() +
        getViewerDataHelpersCore() +
        getViewerDataAddScript();
    const ctx = vm.createContext({ console });
    vm.runInContext(code, ctx, { filename: 'viewer-stack-header-repeat-sandbox.js', timeout: 10_000 });
    return ctx as unknown as StackSandboxVm;
}
