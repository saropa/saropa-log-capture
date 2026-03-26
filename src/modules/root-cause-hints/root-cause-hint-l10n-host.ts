/**
 * Host-side strings for the root-cause hypotheses webview strip (DB_14 phase 2).
 */

import { t } from "../../l10n";

/** JSON-safe map posted to the webview as `setRootCauseHintL10n`. */
export function getRootCauseHintViewerStrings(): Record<string, string> {
  return {
    title: t("viewer.rchTitle"),
    dismissAria: t("viewer.rchDismissAria"),
    dismissTitle: t("viewer.rchDismissTitle"),
    explainAi: t("viewer.rchExplainAi"),
    collapseAria: t("viewer.rchCollapseAria"),
    collapseTitle: t("viewer.rchCollapseTitle"),
    expandAria: t("viewer.rchExpandAria"),
    expandTitle: t("viewer.rchExpandTitle"),
    copyAria: t("viewer.rchCopyAria"),
    copied: t("viewer.rchCopied"),
    confTooltipMedium: t("viewer.rchConfTooltipMedium"),
    confTooltipLow: t("viewer.rchConfTooltipLow"),
  };
}
