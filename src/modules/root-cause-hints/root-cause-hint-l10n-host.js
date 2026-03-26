"use strict";
/**
 * Host-side strings for the root-cause hypotheses webview strip (DB_14 phase 2).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootCauseHintViewerStrings = getRootCauseHintViewerStrings;
const l10n_1 = require("../../l10n");
/** JSON-safe map posted to the webview as `setRootCauseHintL10n`. */
function getRootCauseHintViewerStrings() {
    return {
        title: (0, l10n_1.t)("viewer.rchTitle"),
        dismissAria: (0, l10n_1.t)("viewer.rchDismissAria"),
        dismissTitle: (0, l10n_1.t)("viewer.rchDismissTitle"),
        explainAi: (0, l10n_1.t)("viewer.rchExplainAi"),
        collapseAria: (0, l10n_1.t)("viewer.rchCollapseAria"),
        collapseTitle: (0, l10n_1.t)("viewer.rchCollapseTitle"),
        expandAria: (0, l10n_1.t)("viewer.rchExpandAria"),
        expandTitle: (0, l10n_1.t)("viewer.rchExpandTitle"),
        copyAria: (0, l10n_1.t)("viewer.rchCopyAria"),
        copied: (0, l10n_1.t)("viewer.rchCopied"),
        confTooltipMedium: (0, l10n_1.t)("viewer.rchConfTooltipMedium"),
        confTooltipLow: (0, l10n_1.t)("viewer.rchConfTooltipLow"),
    };
}
//# sourceMappingURL=root-cause-hint-l10n-host.js.map