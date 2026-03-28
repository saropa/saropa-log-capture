"use strict";
/**
 * UI-only integration adapter identifiers (Saropa Log Capture)
 *
 * The Integrations webview lists session adapters from `saropaLogCapture.integrations.adapters`
 * plus rows that configure other product toggles. Those extra rows must never be written back
 * into `integrations.adapters` or session providers would see bogus ids.
 *
 * - `explainWithAi` mirrors `saropaLogCapture.ai.enabled`; the webview receives a merged id
 *   list (`mergeIntegrationAdaptersForWebview`) so checkboxes stay in sync when AI or adapter
 *   settings change (including from Settings JSON).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPLAIN_WITH_AI_ADAPTER_ID = void 0;
exports.stripUiOnlyIntegrationAdapterIds = stripUiOnlyIntegrationAdapterIds;
exports.mergeIntegrationAdaptersForWebview = mergeIntegrationAdaptersForWebview;
/** Maps to saropaLogCapture.ai.enabled — Explain with AI and related LM calls. */
exports.EXPLAIN_WITH_AI_ADAPTER_ID = 'explainWithAi';
/** Remove UI-only ids so they are never persisted as session adapters. */
function stripUiOnlyIntegrationAdapterIds(ids) {
    return ids.filter((id) => id !== exports.EXPLAIN_WITH_AI_ADAPTER_ID);
}
/** Build the adapter id list sent to the webview (session adapters + optional Explain with AI). */
function mergeIntegrationAdaptersForWebview(sessionAdapterIds, aiExplainEnabled) {
    const base = stripUiOnlyIntegrationAdapterIds([...sessionAdapterIds]);
    if (aiExplainEnabled) {
        return [...base, exports.EXPLAIN_WITH_AI_ADAPTER_ID];
    }
    return base;
}
//# sourceMappingURL=integration-adapter-constants.js.map