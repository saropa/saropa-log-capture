/**
 * Shared sandbox builder and VM interfaces for SQL repeat compression tests.
 * Extracted from viewer-sql-repeat-compression.test.ts to keep file under line limit.
 */
import * as vm from 'node:vm';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getSqlDrilldownUiScript } from '../../ui/viewer/viewer-data-sql-drilldown-ui';
import { getViewerDbDetectorFrameworkScript } from '../../ui/viewer/viewer-db-detector-framework-script';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

export interface RepeatTrackerVm {
    lastHash: string | null;
    count: number;
    lastLineIndex: number;
    streakSqlFp: boolean;
    sqlStreakFingerprint: string | null;
}

export interface SqlRepeatDrilldownVm {
    fingerprint: string;
    repeatCount: number;
    variants: { argsKey: string; count: number }[];
    moreVariantCount: number;
}

export interface LineItemVm {
    type: string;
    html?: string;
    height: number;
    repeatHidden?: boolean;
    seq?: number;
    sqlRepeatDrilldown?: SqlRepeatDrilldownVm;
    sqlRepeatDrilldownOpen?: boolean;
}

export interface SandboxVm {
    /** Mirrors embedded `addToData` arity (positional args are fixed in the viewer script). */
    addToData: (...args: unknown[]) => void;
    allLines: LineItemVm[];
    totalHeight: number;
    repeatTracker: RepeatTrackerVm;
    cleanupTrailingRepeats: () => void;
    parseSqlFingerprint: ((plain: string) => { fingerprint: string } | null) | undefined;
    recalcHeights: () => void;
    toggleSqlRepeatDrilldown: (seq: number) => void;
    calcItemHeight: (item: LineItemVm) => number;
}

function buildSandboxScript(): string {
    // Stubs and globals required before the real viewer chunks (mirrors load order in viewer-data.ts).
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
var viewerGroupAsciiArt = true;
var viewerDetectAsciiArt = false;
var showFlutter = 'all';
var showDevice = 'none';
function isTierHidden() { return false; }
/* getDriftDebugServerFromLogScript assigns to window; Node vm has no browser global. */
var window = globalThis;

function stripTags(html) { var s = (html == null ? '' : String(html)).replace(/<[^>]*>/g, ''); return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }
function isStackFrameText() { return false; }
function parseClassTags() { return []; }
function parseLogcatTag() { return null; }
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

function recalcHeights() {
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].height = calcItemHeight(allLines[i]);
        totalHeight += allLines[i].height;
    }
}
function renderViewport() {}

/* Minimal parseSourceTag aligned with source-tag-parser driftStatementPattern gate. */
function parseSourceTag(plainText) {
    var sourceTagPattern = /^(?:([VDIWEFA])\\/([^(:\\s]+)\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[([^\\]]+)\\]\\s)/;
    var driftStatementPattern = /\\bDrift:\\s+Sent\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
    var m = sourceTagPattern.exec(plainText);
    if (m) {
        var raw = m[2] || m[3];
        if (!raw) return null;
        var tag = raw.toLowerCase();
        var body = plainText.slice(m[0].length);
        if (driftStatementPattern.test(body)) return 'database';
        return tag;
    }
    return null;
}
`;
}

export function loadViewerRepeatSandbox(): SandboxVm {
    const code =
        buildSandboxScript() +
        getNPlusOneDetectorScript(VIEWER_REPEAT_THRESHOLD_DEFAULTS) +
        getViewerDbDetectorFrameworkScript(false) +
        getSqlDrilldownUiScript() +
        getViewerDataHelpersCore() +
        getViewerDataAddScript();
    const ctx = vm.createContext({ console });
    vm.runInContext(code, ctx, { filename: 'viewer-sql-repeat-compression-sandbox.js', timeout: 10_000 });
    return ctx as unknown as SandboxVm;
}
