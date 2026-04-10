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
(0, node_test_1.default)("should filter dismissed signals from copy-all", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("hVisible"), "copy-all handler must filter to visible signals only");
});
(0, node_test_1.default)("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchStr('confTooltipMedium'"));
    strict_1.default.ok(chunk.includes("rchStr('confTooltipLow'"));
    strict_1.default.ok(chunk.includes("root-cause-hyp-conf--"));
    strict_1.default.ok(chunk.includes('role="img"'));
    strict_1.default.ok(!chunk.includes("rchStr('confPrefix'"));
});
(0, node_test_1.default)("error collector skips recentErrorContext lines (proximity-inherited errors)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("row.recentErrorContext"), "collect loop must filter out proximity-inherited error lines to prevent duplicate hypotheses from stack-frame continuations");
});
//# sourceMappingURL=viewer-root-cause-hints-embed.test.js.map