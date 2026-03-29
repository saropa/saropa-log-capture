"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * VM tests for **`annotate-line`** and primary ingest rollup wiring (plan **DB_15**).
 *
 * Runs the same script chunks as `viewer-sql-repeat-compression.test.ts` plus DB insights on,
 * registers a test detector that patches the current line via **`ctx.anchorSeq`**, and exercises
 * direct **`applyDbAnnotateLineResult`** for false positives and height deltas.
 */
const assert = __importStar(require("node:assert"));
const vm = __importStar(require("node:vm"));
const viewer_data_add_1 = require("../../ui/viewer/viewer-data-add");
const viewer_data_helpers_core_1 = require("../../ui/viewer/viewer-data-helpers-core");
const viewer_db_detector_framework_script_1 = require("../../ui/viewer/viewer-db-detector-framework-script");
const viewer_data_n_plus_one_script_1 = require("../../ui/viewer/viewer-data-n-plus-one-script");
const drift_db_repeat_thresholds_1 = require("../../modules/db/drift-db-repeat-thresholds");
const FLUTTER = "I/flutter (1): ";
function buildAnnotateSandboxScript() {
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
var appOnlyMode = false;

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
function renderViewport() {}

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
const VM_TEST_ANNOTATE_DETECTOR = /* javascript */ `
registerDbDetector({
    id: 'vm.test-annotate-line',
    priority: 20,
    feed: function(ctx) {
        if (typeof ctx.anchorSeq !== 'number' || !isFinite(ctx.anchorSeq)) return [];
        return [{
            kind: 'annotate-line',
            detectorId: 'vm.test-annotate-line',
            stableKey: 'vm.test-annotate-line::' + ctx.anchorSeq,
            priority: 20,
            payload: { targetSeq: ctx.anchorSeq, patch: { level: 'performance', vmTestAnnotate: true } }
        }];
    }
});
`;
function loadAnnotateSandbox() {
    const code = buildAnnotateSandboxScript() +
        (0, viewer_data_n_plus_one_script_1.getNPlusOneDetectorScript)(drift_db_repeat_thresholds_1.VIEWER_REPEAT_THRESHOLD_DEFAULTS) +
        (0, viewer_db_detector_framework_script_1.getViewerDbDetectorFrameworkScript)(true) +
        (0, viewer_data_helpers_core_1.getViewerDataHelpersCore)() +
        (0, viewer_data_add_1.getViewerDataAddScript)() +
        VM_TEST_ANNOTATE_DETECTOR;
    const ctx = vm.createContext({ console, window: {} });
    vm.runInContext(code, ctx, { filename: "viewer-db-detector-annotate-line-sandbox.js", timeout: 10_000 });
    return ctx;
}
function driftOneRow() {
    return `${FLUTTER}Drift: Sent SELECT 1 with args []`;
}
suite("Viewer DB annotate-line (DB_15 VM)", () => {
    test("detector annotate-line patches current line via anchorSeq", () => {
        const s = loadAnnotateSandbox();
        const t0 = 5_000_000;
        s.addToData(driftOneRow(), false, "stdout", t0, false, null, undefined, undefined, "debug");
        assert.strictEqual(s.allLines.length, 1);
        const line = s.allLines[0];
        assert.strictEqual(line.type, "line");
        assert.strictEqual(line.vmTestAnnotate, true);
        assert.strictEqual(line.level, "performance");
        assert.ok(line.dbInsight);
    });
    test("applyDbAnnotateLineResult: unknown targetSeq is no-op (false positive guard)", () => {
        const s = loadAnnotateSandbox();
        const t0 = 5_100_000;
        s.addToData(driftOneRow(), false, "stdout", t0, false, null, undefined, undefined, "debug");
        const before = JSON.stringify(s.allLines);
        const h = s.totalHeight;
        s.applyDbAnnotateLineResult({
            kind: "annotate-line",
            detectorId: "x",
            stableKey: "x",
            priority: 0,
            payload: { targetSeq: 99_999, patch: { bad: true } },
        });
        assert.strictEqual(JSON.stringify(s.allLines), before);
        assert.strictEqual(s.totalHeight, h);
        assert.ok(!s.allLines.some((l) => l.bad === true));
    });
    test("applyDbAnnotateLineResult: height patch adjusts totalHeight", () => {
        const s = loadAnnotateSandbox();
        const t0 = 5_200_000;
        s.addToData(driftOneRow(), false, "stdout", t0, false, null, undefined, undefined, "debug");
        const seq = s.allLines[0].seq;
        assert.ok(typeof seq === "number");
        assert.strictEqual(s.totalHeight, 20);
        s.applyDbAnnotateLineResult({
            kind: "annotate-line",
            detectorId: "h",
            stableKey: "h",
            priority: 0,
            payload: { targetSeq: seq, patch: { height: 0 } },
        });
        assert.strictEqual(s.allLines[0].height, 0);
        assert.strictEqual(s.totalHeight, 0);
    });
});
//# sourceMappingURL=viewer-db-detector-annotate-line.test.js.map