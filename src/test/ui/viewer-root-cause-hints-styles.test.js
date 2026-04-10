"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Regression tests for Signals strip CSS: evidence controls must not use native button chrome
 * (before: light background in dark webviews; after: link-like reset + theme tokens).
 * Also verifies dismiss/restore button styles are present.
 */
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const viewer_styles_root_cause_hints_1 = require("../../ui/viewer-styles/viewer-styles-root-cause-hints");
(0, node_test_1.default)("Signals evidence buttons reset UA styling to theme link appearance", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    strict_1.default.match(css, /\.root-cause-hyp-evidence\s*\{.*?border:\s*none.*?background:\s*transparent.*?--vscode-textLink-foreground.*?appearance:\s*none/s, "evidence rule must reset UA button and keep theme link + appearance:none");
    strict_1.default.match(css, /\.root-cause-hyp-evidence:hover\s*\{.*?textLink-activeForeground/s, "hover should prefer active link foreground when theme provides it");
});
(0, node_test_1.default)("should contain dismiss button styles with hover-reveal pattern", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    strict_1.default.ok(css.includes(".rch-dismiss-btn"), "dismiss button class must exist");
    strict_1.default.match(css, /\.rch-dismiss-btn\s*\{.*?opacity:\s*0/s, "dismiss button must be hidden by default");
    strict_1.default.match(css, /li:hover\s+\.rch-dismiss-btn\s*\{.*?opacity:\s*1/s, "dismiss button must appear on li hover");
    strict_1.default.match(css, /\.rch-dismiss-btn:hover\s*\{.*?errorForeground/s, "dismiss button hover must use error foreground color");
});
(0, node_test_1.default)("should contain restore button styles", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    strict_1.default.ok(css.includes(".rch-restore-btn"), "restore button class must exist");
    strict_1.default.match(css, /\.rch-restore-btn:hover\s*\{.*?textLink-foreground/s, "restore button hover must use link foreground color");
});
//# sourceMappingURL=viewer-root-cause-hints-styles.test.js.map