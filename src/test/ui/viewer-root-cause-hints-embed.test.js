"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * String-level regression tests for the root-cause hypotheses embed only (no `vscode` dependency chain).
 */
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const viewer_root_cause_hints_script_1 = require("../../ui/viewer/viewer-root-cause-hints-script");
(0, node_test_1.default)("should contain dismiss button with rch-dismiss-btn class", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rch-dismiss-btn"), "dismiss button class must exist");
    strict_1.default.ok(chunk.includes('data-rch-dismiss="'), "dismiss button must carry hypothesis key as data attribute");
});
(0, node_test_1.default)("should contain rchDismissedKeys for session dismiss state", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchDismissedKeys"), "dismissed keys object must exist");
    strict_1.default.ok(chunk.includes("Signal hidden for this session"), "dismiss toast message must exist");
});
(0, node_test_1.default)("should contain restore button with rch-restore-btn class", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rch-restore-btn"), "restore button class must exist");
    strict_1.default.ok(chunk.includes("dismissed"), "restore button text must mention dismissed count");
});
(0, node_test_1.default)("should open report panel when signal text clicked", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rch-report-btn"), "signal text must be a clickable report button");
    strict_1.default.ok(chunk.includes("openSignalReport"), "clicking signal must post openSignalReport to host");
});
(0, node_test_1.default)("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchStr('confTooltipMedium'"));
    strict_1.default.ok(chunk.includes("rchStr('confTooltipLow'"));
    strict_1.default.ok(chunk.includes("root-cause-hyp-conf--"));
    strict_1.default.ok(chunk.includes('role="img"'));
    strict_1.default.ok(!chunk.includes("rchStr('confPrefix'"));
});
(0, node_test_1.default)("should not auto-open signals panel when signals are detected", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(!chunk.includes("showSignalsPanel"), "render function must not call showSignalsPanel — panel stays hidden until the user clicks the toolbar icon");
});
(0, node_test_1.default)("error collector skips recentErrorContext lines (proximity-inherited errors)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("row.recentErrorContext"), "collect loop must filter out proximity-inherited error lines to prevent duplicate hypotheses from stack-frame continuations");
});
(0, node_test_1.default)("should contain PERF regex for slow-operation detection", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchPerfRe"), "PERF regex must be defined for PERF-line slow-op detection");
    strict_1.default.ok(chunk.includes("operationName"), "slow-op collection must pass operationName from PERF lines");
});
(0, node_test_1.default)("excerpt truncation uses shared rchExcerpt helper (no inline duplication)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("function rchExcerpt("), "rchExcerpt helper must be defined");
    /* The inline pattern should no longer appear — all call sites use the helper. */
    const inlineCount = (chunk.match(/plain\.length > 200/g) || []).length;
    strict_1.default.strictEqual(inlineCount, 0, "no inline 200-char truncation should remain — all must use rchExcerpt");
});
// --- HTTP status code detection ---
(0, node_test_1.default)("should contain HTTP error code map for network-failure signal detection", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchHttpErrorCodes"), "HTTP error codes map must be defined");
    strict_1.default.ok(chunk.includes("rchHttpCodeRe"), "HTTP code regex must be defined");
    /* Verify a sample of known codes appear in the map. */
    strict_1.default.ok(chunk.includes("'404': 'Not Found'"), "404 must be in the known-code map");
    strict_1.default.ok(chunk.includes("'500': 'Internal Server Error'"), "500 must be in the known-code map");
    strict_1.default.ok(chunk.includes("'503': 'Service Unavailable'"), "503 must be in the known-code map");
});
(0, node_test_1.default)("HTTP detection skips database-level lines to avoid SQL false positives", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* The httpMatch guard must check row.level !== 'database'. */
    strict_1.default.ok(chunk.includes("row.level !== 'database'"), "HTTP detection must skip database-level lines to prevent false positives from SQL result sets");
});
(0, node_test_1.default)("HTTP detection pushes to networkFailures with pattern containing code and reason", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* The pattern field should combine code + reason: "404 Not Found". */
    strict_1.default.ok(chunk.includes("httpCode + ' ' + httpReason"), "HTTP pattern must combine status code and reason phrase (e.g. '404 Not Found')");
});
// --- originalLevel / pre-demotion signal analysis (plan 050) ---
(0, node_test_1.default)("signal collector uses originalLevel for warning detection (plan 050)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* The collector must read row.originalLevel (set by viewer-data-add when device-other
       demotion occurs) so demoted warnings still feed the warning-recurring signal. */
    strict_1.default.ok(chunk.includes("row.originalLevel || row.level"), "signalLevel must fall back from originalLevel to level so demoted lines are analyzed");
});
(0, node_test_1.default)("signal collector uses signalLevel (not row.level) for warning check (plan 050)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* Before plan 050, the check was `row.level === 'warning'` which missed demoted lines.
       After, it must use `signalLevel === 'warning'`. */
    strict_1.default.ok(chunk.includes("signalLevel === 'warning'"), "warning collection must check signalLevel, not row.level");
});
(0, node_test_1.default)("signal collector uses signalLevel (not row.level) for error check (plan 050)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* Same pattern for errors: demoted device-other errors must still feed classified-error
       and network-failure signal detection. */
    strict_1.default.ok(chunk.includes("signalLevel === 'error'"), "error collection must check signalLevel, not row.level");
});
(0, node_test_1.default)("HTTP detection still uses row.level for database exclusion (plan 050 no-change)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    /* HTTP status code detection intentionally uses the DISPLAY level (row.level) for its
       database exclusion guard — this is a display-category check, not a signal-level check. */
    strict_1.default.ok(chunk.includes("row.level !== 'database'"), "HTTP database guard must remain on row.level (display concern, not signal concern)");
});
(0, node_test_1.default)("slow-op threshold is baked from parameter, not hardcoded", () => {
    /* Default threshold (no arg) should embed 500. */
    const defaultChunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(defaultChunk.includes(">= 500"), "default threshold should be 500");
    /* Custom threshold should be injected. */
    const customChunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)(1000);
    strict_1.default.ok(customChunk.includes(">= 1000"), "custom threshold should be baked into the JS");
    strict_1.default.ok(!customChunk.includes(">= 500"), "default threshold should not appear when custom is set");
});
//# sourceMappingURL=viewer-root-cause-hints-embed.test.js.map