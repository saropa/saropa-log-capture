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

/** Maps to saropaLogCapture.ai.enabled — Explain with AI and related LM calls. */
export const EXPLAIN_WITH_AI_ADAPTER_ID = 'explainWithAi';

/** Remove UI-only ids so they are never persisted as session adapters. */
export function stripUiOnlyIntegrationAdapterIds(ids: readonly string[]): string[] {
    return ids.filter((id) => id !== EXPLAIN_WITH_AI_ADAPTER_ID);
}

/** Build the adapter id list sent to the webview (session adapters + optional Explain with AI). */
export function mergeIntegrationAdaptersForWebview(
    sessionAdapterIds: readonly string[],
    aiExplainEnabled: boolean,
): string[] {
    const base = stripUiOnlyIntegrationAdapterIds([...sessionAdapterIds]);
    if (aiExplainEnabled) {
        return [...base, EXPLAIN_WITH_AI_ADAPTER_ID];
    }
    return base;
}
