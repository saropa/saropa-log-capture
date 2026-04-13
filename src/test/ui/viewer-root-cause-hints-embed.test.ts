/**
 * String-level regression tests for the root-cause hypotheses embed only (no `vscode` dependency chain).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getViewerRootCauseHintsScript } from "../../ui/viewer/viewer-root-cause-hints-script";

test("should contain dismiss button with rch-dismiss-btn class", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rch-dismiss-btn"), "dismiss button class must exist");
  assert.ok(chunk.includes('data-rch-dismiss="'), "dismiss button must carry hypothesis key as data attribute");
});

test("should contain rchDismissedKeys for session dismiss state", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchDismissedKeys"), "dismissed keys object must exist");
  assert.ok(chunk.includes("Signal hidden for this session"), "dismiss toast message must exist");
});

test("should contain restore button with rch-restore-btn class", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rch-restore-btn"), "restore button class must exist");
  assert.ok(chunk.includes("dismissed"), "restore button text must mention dismissed count");
});

test("should open report panel when signal text clicked", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rch-report-btn"), "signal text must be a clickable report button");
  assert.ok(chunk.includes("openSignalReport"), "clicking signal must post openSignalReport to host");
});

test("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchStr('confTooltipMedium'"));
  assert.ok(chunk.includes("rchStr('confTooltipLow'"));
  assert.ok(chunk.includes("root-cause-hyp-conf--"));
  assert.ok(chunk.includes('role="img"'));
  assert.ok(!chunk.includes("rchStr('confPrefix'"));
});

test("should not auto-open signals panel when signals are detected", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(
    !chunk.includes("showSignalsPanel"),
    "render function must not call showSignalsPanel — panel stays hidden until the user clicks the toolbar icon",
  );
});

test("error collector skips recentErrorContext lines (proximity-inherited errors)", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(
    chunk.includes("row.recentErrorContext"),
    "collect loop must filter out proximity-inherited error lines to prevent duplicate hypotheses from stack-frame continuations",
  );
});

test("should contain PERF regex for slow-operation detection", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchPerfRe"), "PERF regex must be defined for PERF-line slow-op detection");
  assert.ok(chunk.includes("operationName"), "slow-op collection must pass operationName from PERF lines");
});

// --- HTTP status code detection ---

test("should contain HTTP error code map for network-failure signal detection", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchHttpErrorCodes"), "HTTP error codes map must be defined");
  assert.ok(chunk.includes("rchHttpCodeRe"), "HTTP code regex must be defined");
  /* Verify a sample of known codes appear in the map. */
  assert.ok(chunk.includes("'404': 'Not Found'"), "404 must be in the known-code map");
  assert.ok(chunk.includes("'500': 'Internal Server Error'"), "500 must be in the known-code map");
  assert.ok(chunk.includes("'503': 'Service Unavailable'"), "503 must be in the known-code map");
});

test("HTTP detection skips database-level lines to avoid SQL false positives", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* The httpMatch guard must check row.level !== 'database'. */
  assert.ok(
    chunk.includes("row.level !== 'database'"),
    "HTTP detection must skip database-level lines to prevent false positives from SQL result sets",
  );
});

test("HTTP detection pushes to networkFailures with pattern containing code and reason", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* The pattern field should combine code + reason: "404 Not Found". */
  assert.ok(
    chunk.includes("httpCode + ' ' + httpReason"),
    "HTTP pattern must combine status code and reason phrase (e.g. '404 Not Found')",
  );
});

// --- originalLevel / pre-demotion signal analysis (plan 050) ---

test("signal collector uses originalLevel for warning detection (plan 050)", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* The collector must read row.originalLevel (set by viewer-data-add when device-other
     demotion occurs) so demoted warnings still feed the warning-recurring signal. */
  assert.ok(
    chunk.includes("row.originalLevel || row.level"),
    "signalLevel must fall back from originalLevel to level so demoted lines are analyzed",
  );
});

test("signal collector uses signalLevel (not row.level) for warning check (plan 050)", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* Before plan 050, the check was `row.level === 'warning'` which missed demoted lines.
     After, it must use `signalLevel === 'warning'`. */
  assert.ok(
    chunk.includes("signalLevel === 'warning'"),
    "warning collection must check signalLevel, not row.level",
  );
});

test("signal collector uses signalLevel (not row.level) for error check (plan 050)", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* Same pattern for errors: demoted device-other errors must still feed classified-error
     and network-failure signal detection. */
  assert.ok(
    chunk.includes("signalLevel === 'error'"),
    "error collection must check signalLevel, not row.level",
  );
});

test("HTTP detection still uses row.level for database exclusion (plan 050 no-change)", () => {
  const chunk = getViewerRootCauseHintsScript();
  /* HTTP status code detection intentionally uses the DISPLAY level (row.level) for its
     database exclusion guard — this is a display-category check, not a signal-level check. */
  assert.ok(
    chunk.includes("row.level !== 'database'"),
    "HTTP database guard must remain on row.level (display concern, not signal concern)",
  );
});

test("slow-op threshold is baked from parameter, not hardcoded", () => {
  /* Default threshold (no arg) should embed 500. */
  const defaultChunk = getViewerRootCauseHintsScript();
  assert.ok(defaultChunk.includes(">= 500"), "default threshold should be 500");

  /* Custom threshold should be injected. */
  const customChunk = getViewerRootCauseHintsScript(1000);
  assert.ok(customChunk.includes(">= 1000"), "custom threshold should be baked into the JS");
  assert.ok(!customChunk.includes(">= 500"), "default threshold should not appear when custom is set");
});
