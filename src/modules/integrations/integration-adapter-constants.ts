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

/**
 * The adb logcat adapter id. Its Options checkbox binds to `integrations.adbLogcat.enabled`
 * (a dedicated boolean), NOT to membership in `integrations.adapters` — so the checkbox reflects
 * the real on/off and an uncheck is authoritative. In the webview it is a UI-only merged id like
 * {@link EXPLAIN_WITH_AI_ADAPTER_ID}: added to the displayed list when enabled, and routed to the
 * boolean (not the adapters array) on write.
 */
export const ADB_LOGCAT_ADAPTER_ID = 'adbLogcat';

/**
 * Remove the Explain-with-AI UI-only id so it is never persisted as a session adapter.
 *
 * NOTE: adbLogcat is intentionally NOT stripped here. This function also runs on the READ path
 * (config load), and the provider's power-user "force on a non-Dart session" path still reads an
 * explicit `adbLogcat` entry from the persisted adapters array. adbLogcat is instead pulled out of
 * the checkbox WRITE payload in the setIntegrationsAdapters handler, where it maps to the boolean.
 */
export function stripUiOnlyIntegrationAdapterIds(ids: readonly string[]): string[] {
    return ids.filter((id) => id !== EXPLAIN_WITH_AI_ADAPTER_ID);
}

/**
 * Build the adapter id list sent to the webview: session adapters plus the two checkbox-only
 * toggles (Explain with AI, adb logcat) reflected from their own settings. adbLogcat's displayed
 * checkbox state follows `adbLogcatEnabled`, independent of whether the array happens to contain it.
 */
export function mergeIntegrationAdaptersForWebview(
    sessionAdapterIds: readonly string[],
    aiExplainEnabled: boolean,
    adbLogcatEnabled: boolean,
): string[] {
    // Drop any array copy of adbLogcat so the checkbox reflects the boolean, then re-add iff enabled.
    let base = stripUiOnlyIntegrationAdapterIds([...sessionAdapterIds])
        .filter((id) => id !== ADB_LOGCAT_ADAPTER_ID);
    if (adbLogcatEnabled) { base = [...base, ADB_LOGCAT_ADAPTER_ID]; }
    if (aiExplainEnabled) { base = [...base, EXPLAIN_WITH_AI_ADAPTER_ID]; }
    return base;
}
