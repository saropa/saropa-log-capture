"use strict";
/**
 * Pure merge for Drift Advisor DB panel payload (Performance → Database tab, DB_13).
 * Kept separate from `drift-advisor-db-panel-load.ts` so unit tests avoid the `vscode` module.
 * @see plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeDriftAdvisorDbPanelPayload = mergeDriftAdvisorDbPanelPayload;
/** Shallow merge: sidecar fills gaps when session meta is partial or missing. */
function mergeDriftAdvisorDbPanelPayload(fromMeta, sidecar) {
    const base = fromMeta && typeof fromMeta === "object" && !Array.isArray(fromMeta)
        ? { ...fromMeta }
        : {};
    if (!sidecar) {
        return Object.keys(base).length ? base : null;
    }
    if (!base.baseUrl && typeof sidecar.baseUrl === "string") {
        base.baseUrl = sidecar.baseUrl;
    }
    const sp = sidecar.performance;
    if (sp && typeof sp === "object" && !Array.isArray(sp) && base.performance === undefined) {
        base.performance = sp;
    }
    return Object.keys(base).length ? base : null;
}
//# sourceMappingURL=drift-advisor-db-panel-payload.js.map