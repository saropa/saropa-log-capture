/**
 * Maps declared package dependencies to the integration adapter ids that enrich
 * them, then narrows to adapters the user has not already enabled (plan 106,
 * R2/R3). Pure — no I/O, no VS Code API — so the mapping is fully unit-testable.
 *
 * Adapter ids are the exact strings each provider's `isEnabled` tests via
 * `integrationsAdapters.includes(...)`. Keep this table in sync with the
 * providers registered in activation-integrations.ts.
 *
 * Credential- or path-gated adapters (buildCi, security, windowsEvents) are
 * intentionally absent: enabling them alone does nothing without sub-config, so
 * recommending them would be noise.
 */

/** A single recommendation: one adapter id and the dependency that triggered it. */
export interface AdapterRecommendation {
    readonly adapter: string;
    readonly trigger: string;
}

/**
 * pubspec dependency name (exact match) → adapter ids it implies. A dependency
 * absent from this table produces no recommendation.
 */
const pubspecAdapterMap: ReadonlyMap<string, readonly string[]> = new Map([
    ['firebase_crashlytics', ['crashlytics']],
    ['drift', ['database', 'driftAdvisor']],
    ['moor', ['database', 'driftAdvisor']],
    ['sqflite', ['database']],
    ['sqlite3', ['database']],
    ['dio', ['http']],
    ['http', ['http']],
    ['chopper', ['http']],
    ['retrofit', ['http']],
    ['flutter_test', ['testResults']],
    ['test', ['testResults']],
    ['integration_test', ['testResults']],
    ['coverage', ['coverage']],
    // The Flutter SDK marker implies a mobile target worth wiring device + crash capture for.
    ['flutter', ['adbLogcat', 'flutterCrashLogs']],
]);

/**
 * Given the dependency names declared in a pubspec and the adapters already
 * enabled, return the adapters worth suggesting — each paired with the
 * dependency that triggered it, deduped by adapter (first trigger wins), and
 * excluding anything already enabled. Empty result means "offer nothing".
 */
export function suggestAdaptersFromPubspec(
    dependencies: ReadonlySet<string>,
    enabledAdapters: readonly string[],
): AdapterRecommendation[] {
    const enabled = new Set(enabledAdapters);
    const seen = new Set<string>();
    const out: AdapterRecommendation[] = [];

    for (const dep of dependencies) {
        const adapters = pubspecAdapterMap.get(dep);
        if (!adapters) { continue; }
        for (const adapter of adapters) {
            if (enabled.has(adapter) || seen.has(adapter)) { continue; }
            seen.add(adapter);
            out.push({ adapter, trigger: dep });
        }
    }
    return out;
}
