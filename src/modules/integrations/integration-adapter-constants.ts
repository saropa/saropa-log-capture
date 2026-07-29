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
 * The debug-screenshots adapter id (plan 114). Same UI-only checkbox-to-boolean shape as
 * {@link ADB_LOGCAT_ADAPTER_ID}: the Options checkbox binds to `integrations.screenshots.enabled`,
 * never to membership in `integrations.adapters`, so on-by-default reaches users who already
 * customized the adapters array and an uncheck is authoritative.
 */
export const SCREENSHOTS_ADAPTER_ID = 'screenshots';

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
 * Build the adapter id list sent to the webview: session adapters plus the checkbox-only
 * toggles (Explain with AI, adb logcat, screenshots) reflected from their own settings.
 * Each boolean-backed checkbox state follows its flag, independent of whether the array
 * happens to contain the id.
 */
export function mergeIntegrationAdaptersForWebview(
    sessionAdapterIds: readonly string[],
    aiExplainEnabled: boolean,
    adbLogcatEnabled: boolean,
    screenshotsEnabled: boolean,
): string[] {
    // Drop any array copy of the boolean-backed ids so checkboxes reflect the booleans, then re-add iff enabled.
    let base = stripUiOnlyIntegrationAdapterIds([...sessionAdapterIds])
        .filter((id) => id !== ADB_LOGCAT_ADAPTER_ID && id !== SCREENSHOTS_ADAPTER_ID);
    if (adbLogcatEnabled) { base = [...base, ADB_LOGCAT_ADAPTER_ID]; }
    if (screenshotsEnabled) { base = [...base, SCREENSHOTS_ADAPTER_ID]; }
    if (aiExplainEnabled) { base = [...base, EXPLAIN_WITH_AI_ADAPTER_ID]; }
    return base;
}
