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
(0, node_test_1.default)("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
    const chunk = (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)();
    strict_1.default.ok(chunk.includes("rchStr('confTooltipMedium'"));
    strict_1.default.ok(chunk.includes("rchStr('confTooltipLow'"));
    strict_1.default.ok(chunk.includes("root-cause-hyp-conf--"));
    strict_1.default.ok(chunk.includes('role="img"'));
    strict_1.default.ok(!chunk.includes("rchStr('confPrefix'"));
});
//# sourceMappingURL=viewer-root-cause-hints-embed.test.js.map
