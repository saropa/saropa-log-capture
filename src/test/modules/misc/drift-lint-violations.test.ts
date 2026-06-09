/**
 * DB_18 Phase 3 — `buildDriftLintResult` unit tests.
 *
 * Covers the Drift-rule filter (only rules containing "drift"), message prefix stripping, and the
 * enable-pack advice logic: suggested when the project uses Drift but no Drift-rule findings exist
 * (pack off by default), and when no export exists at all but Drift is in use.
 */
import * as assert from 'node:assert';
import { buildDriftLintResult } from '../../../modules/misc/drift-lint-violations';
import type { RawExport } from '../../../modules/misc/lint-violation-reader-io';

function exportWith(violations: RawExport['violations'], tier = 'recommended'): RawExport {
    return { schema: '1.0', config: { tier }, violations };
}

suite('buildDriftLintResult (DB_18 Phase 3)', () => {
    test('keeps only Drift-rule violations and strips the [rule] message prefix', () => {
        const raw = exportWith([
            { rule: 'avoid_drift_update_without_where', message: '[avoid_drift_update_without_where] UPDATE without WHERE', file: 'lib/db.dart', line: 12, severity: 'warning' },
            { rule: 'avoid_print', message: '[avoid_print] no prints', file: 'lib/main.dart', line: 3 },
            { rule: 'require_drift_database_close', message: 'database never closed', file: 'lib/db.dart', line: 40 },
        ]);
        const r = buildDriftLintResult(raw, true);
        assert.strictEqual(r.hasExport, true);
        assert.strictEqual(r.violations.length, 2, 'only the two drift rules are kept');
        assert.strictEqual(r.violations[0].message, 'UPDATE without WHERE', 'prefix stripped');
        assert.strictEqual(r.violations[0].rule, 'avoid_drift_update_without_where');
        assert.strictEqual(r.suggestEnablePack, false, 'findings exist → no enable-pack advice');
        assert.strictEqual(r.tier, 'recommended');
    });

    test('export present but no Drift findings + project uses Drift → suggest enabling the pack', () => {
        const r = buildDriftLintResult(exportWith([{ rule: 'avoid_print', message: 'x', file: 'a.dart', line: 1 }]), true);
        assert.strictEqual(r.violations.length, 0);
        assert.strictEqual(r.suggestEnablePack, true);
    });

    test('no Drift findings but project does NOT use Drift → no advice', () => {
        const r = buildDriftLintResult(exportWith([]), false);
        assert.strictEqual(r.suggestEnablePack, false);
    });

    test('no export at all → advice only when the project uses Drift', () => {
        assert.strictEqual(buildDriftLintResult(undefined, true).suggestEnablePack, true);
        assert.strictEqual(buildDriftLintResult(undefined, true).hasExport, false);
        assert.strictEqual(buildDriftLintResult(undefined, false).suggestEnablePack, false);
    });
});
