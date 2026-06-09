/**
 * DB_17 Step 1 — webview-side cumulative state smoke tests.
 *
 * Runs the same embedded runtime the webview ships and verifies:
 *  - cumulative payload setter populates the module-level map,
 *  - the toggle preference flag round-trips through the helper,
 *  - hasSqlQueryHistoryCumulativeData reflects an empty vs populated payload.
 *
 * Render-merge behavior (live wins on preview, cross-log rows tagged) is exercised
 * by the panel-script tests against the bundled getSqlQueryHistoryPanelHelpersScript.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getSqlQueryHistoryRuntimeScript } from '../../ui/viewer-stack-tags/viewer-sql-query-history-core';

interface CumulativeSandbox {
    sqlQueryHistoryCumulative: unknown;
    sqlQueryHistoryCurrentSessionOnly: boolean;
    setSqlQueryHistoryCumulativeFromHost: (payload: unknown) => void;
    setSqlQueryHistoryCurrentSessionOnly: (on: boolean) => void;
    hasSqlQueryHistoryCumulativeData: () => boolean;
}

function loadCumulativeRuntime(): CumulativeSandbox {
    /* No vscodeApi in the sandbox — the loader's try/catch must swallow the missing API
       so the script still defines the cumulative helpers. */
    const context = vm.createContext({ allLines: [] });
    vm.runInContext(getSqlQueryHistoryRuntimeScript(), context, { timeout: 5_000 });
    return context as unknown as CumulativeSandbox;
}

suite('viewer SQL history cumulative VM (DB_17 Step 1)', () => {
    test('runtime defines all cumulative helpers even without vscodeApi', () => {
        const ctx = loadCumulativeRuntime();
        assert.strictEqual(typeof ctx.setSqlQueryHistoryCumulativeFromHost, 'function');
        assert.strictEqual(typeof ctx.setSqlQueryHistoryCurrentSessionOnly, 'function');
        assert.strictEqual(typeof ctx.hasSqlQueryHistoryCumulativeData, 'function');
        assert.strictEqual(ctx.sqlQueryHistoryCurrentSessionOnly, false, 'default off — cumulative merged by default');
        assert.strictEqual(ctx.sqlQueryHistoryCumulative, null, 'default null payload');
    });

    test('hasSqlQueryHistoryCumulativeData reports false on null and on empty fingerprints', () => {
        const ctx = loadCumulativeRuntime();
        assert.strictEqual(ctx.hasSqlQueryHistoryCumulativeData(), false);
        ctx.setSqlQueryHistoryCumulativeFromHost({ contributingLogCount: 0, missingSummaryLogCount: 0, fingerprints: {} });
        assert.strictEqual(ctx.hasSqlQueryHistoryCumulativeData(), false);
    });

    test('hasSqlQueryHistoryCumulativeData reports true when payload carries fingerprints', () => {
        const ctx = loadCumulativeRuntime();
        ctx.setSqlQueryHistoryCumulativeFromHost({
            contributingLogCount: 1,
            missingSummaryLogCount: 0,
            fingerprints: { fpA: { count: 3, logCount: 1, firstSourceUriString: 'file:///r/a.log' } },
        });
        assert.strictEqual(ctx.hasSqlQueryHistoryCumulativeData(), true);
    });

    test('setSqlQueryHistoryCurrentSessionOnly toggles the in-memory flag (state persistence is best-effort)', () => {
        const ctx = loadCumulativeRuntime();
        ctx.setSqlQueryHistoryCurrentSessionOnly(true);
        assert.strictEqual(ctx.sqlQueryHistoryCurrentSessionOnly, true);
        ctx.setSqlQueryHistoryCurrentSessionOnly(false);
        assert.strictEqual(ctx.sqlQueryHistoryCurrentSessionOnly, false);
    });

    test('null payload clears prior cumulative data (host signals "no other logs contribute")', () => {
        const ctx = loadCumulativeRuntime();
        ctx.setSqlQueryHistoryCumulativeFromHost({
            contributingLogCount: 2,
            missingSummaryLogCount: 0,
            fingerprints: { fpZ: { count: 1, logCount: 1, firstSourceUriString: 'file:///r/z.log' } },
        });
        assert.strictEqual(ctx.hasSqlQueryHistoryCumulativeData(), true);
        ctx.setSqlQueryHistoryCumulativeFromHost(null);
        assert.strictEqual(ctx.hasSqlQueryHistoryCumulativeData(), false);
    });
});
