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
    // Fix: test was referencing .root-cause-hyp-evidence which never existed;
    // the actual class is .rch-report-btn (hypothesis text as clickable report button)
    strict_1.default.match(css, /\.rch-report-btn\s*\{.*?border:\s*none.*?background:\s*transparent.*?appearance:\s*none/s, "report button rule must reset UA button chrome + appearance:none");
    strict_1.default.match(css, /\.rch-report-btn:hover\s*\{.*?textLink-foreground/s, "hover should use theme link foreground color");
});
(0, node_test_1.default)("should contain dismiss button styles with hover-reveal pattern", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    strict_1.default.ok(css.includes(".rch-dismiss-btn"), "dismiss button class must exist");
    strict_1.default.match(css, /\.rch-dismiss-btn\s*\{.*?opacity:\s*0/s, "dismiss button must be hidden by default");
    strict_1.default.match(css, /li:hover\s+\.rch-dismiss-btn\s*\{.*?opacity:\s*1/s, "dismiss button must appear on li hover");
    strict_1.default.match(css, /\.rch-dismiss-btn:hover\s*\{.*?errorForeground/s, "dismiss button hover must use error foreground color");
});
(0, node_test_1.default)("should use flex layout on list items so signal text wraps", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    // Before fix: list items used default inline layout, long signal text
    // overflowed the panel. After fix: flex layout constrains the text button.
    strict_1.default.match(css, /\.root-cause-hypotheses-list\s+li\s*\{[^}]*display:\s*flex/s, "list items must use flex layout for wrapping");
    strict_1.default.match(css, /\.root-cause-hypotheses-list\s+li\s*\{[^}]*gap:\s*4px/s, "list items must have gap for spacing between children");
});
(0, node_test_1.default)("should allow report button text to wrap within available width", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    // Before fix: button text never wrapped (default button behavior).
    // After fix: flex:1 + min-width:0 + word-break let long text wrap.
    strict_1.default.match(css, /\.rch-report-btn\s*\{[^}]*flex:\s*1/s, "report button must flex-grow to fill available width");
    strict_1.default.match(css, /\.rch-report-btn\s*\{[^}]*min-width:\s*0/s, "report button must allow shrinking below intrinsic width");
    strict_1.default.match(css, /\.rch-report-btn\s*\{[^}]*word-break:\s*break-word/s, "report button text must break long words to prevent overflow");
});
(0, node_test_1.default)("should prevent emoji and dismiss button from shrinking in flex", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    // Emoji badge and dismiss × must stay fixed-size while text wraps
    strict_1.default.match(css, /\.root-cause-hyp-conf\s*\{[^}]*flex-shrink:\s*0/s, "confidence emoji must not shrink in flex layout");
    strict_1.default.match(css, /\.rch-dismiss-btn\s*\{[^}]*flex-shrink:\s*0/s, "dismiss button must not shrink in flex layout");
});
(0, node_test_1.default)("should contain restore button styles", () => {
    const css = (0, viewer_styles_root_cause_hints_1.getRootCauseHypothesesStyles)();
    strict_1.default.ok(css.includes(".rch-restore-btn"), "restore button class must exist");
    strict_1.default.match(css, /\.rch-restore-btn:hover\s*\{.*?textLink-foreground/s, "restore button hover must use link foreground color");
});
//# sourceMappingURL=viewer-root-cause-hints-styles.test.js.map