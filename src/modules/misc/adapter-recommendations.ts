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
    // The Flutter SDK marker implies an Android/mobile target worth streaming device logs for.
    // Only adbLogcat is suggested: flutterCrashLogs is a registered provider but absent from the
    // integrations picker (INTEGRATION_ADAPTERS), so recommending it would name a raw id the user
    // could not then manage. Adding it to the picker is a separate product decision, not this feature.
    ['flutter', ['adbLogcat']],
]);

/**
 * npm dependency name (exact match) → adapter ids it implies. Mirrors the
 * pubspec table for JavaScript/TypeScript projects. crashlytics is intentionally
 * absent: that adapter is Firebase/mobile-specific, not a fit for a Node/web app.
 */
const packageJsonAdapterMap: ReadonlyMap<string, readonly string[]> = new Map([
    ['jest', ['testResults']],
    ['vitest', ['testResults']],
    ['mocha', ['testResults']],
    ['ava', ['testResults']],
    ['axios', ['http']],
    ['node-fetch', ['http']],
    ['got', ['http']],
    ['undici', ['http']],
    ['pg', ['database']],
    ['mysql', ['database']],
    ['mysql2', ['database']],
    ['better-sqlite3', ['database']],
    ['sqlite3', ['database']],
    ['sequelize', ['database']],
    ['typeorm', ['database']],
    ['prisma', ['database']],
    ['knex', ['database']],
    ['mongodb', ['database']],
    ['mongoose', ['database']],
    ['puppeteer', ['browser']],
    ['playwright', ['browser']],
    ['@playwright/test', ['browser']],
    ['cypress', ['browser']],
    ['selenium-webdriver', ['browser']],
]);

/**
 * Shared core: map dependency names through `adapterMap`, pair each implied
 * adapter with the dependency that triggered it, dedupe by adapter (first
 * trigger wins), and drop anything already enabled. Empty means "offer nothing".
 */
function suggestFromMap(
    dependencies: ReadonlySet<string>,
    enabledAdapters: readonly string[],
    adapterMap: ReadonlyMap<string, readonly string[]>,
): AdapterRecommendation[] {
    const enabled = new Set(enabledAdapters);
    const seen = new Set<string>();
    const out: AdapterRecommendation[] = [];

    for (const dep of dependencies) {
        const adapters = adapterMap.get(dep);
        if (!adapters) { continue; }
        for (const adapter of adapters) {
            if (enabled.has(adapter) || seen.has(adapter)) { continue; }
            seen.add(adapter);
            out.push({ adapter, trigger: dep });
        }
    }
    return out;
}

/** Recommend adapters implied by a pubspec.yaml's dependency names. */
export function suggestAdaptersFromPubspec(
    dependencies: ReadonlySet<string>,
    enabledAdapters: readonly string[],
): AdapterRecommendation[] {
    return suggestFromMap(dependencies, enabledAdapters, pubspecAdapterMap);
}

/** Recommend adapters implied by a package.json's dependency names. */
export function suggestAdaptersFromPackageJson(
    dependencies: ReadonlySet<string>,
    enabledAdapters: readonly string[],
): AdapterRecommendation[] {
    return suggestFromMap(dependencies, enabledAdapters, packageJsonAdapterMap);
}
