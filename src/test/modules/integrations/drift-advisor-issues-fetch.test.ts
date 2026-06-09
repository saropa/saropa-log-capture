/**
 * DB_18 Phase 2 — `normalizeDriftDbIssues` unit tests.
 *
 * Shapes mirror Drift Advisor's `analytics_handler.dart` getIssuesList(): a `{ issues: [...] }`
 * body where each entry carries source / severity / table / message and optional suggestedSql,
 * column, priority. Covers field mapping, the message-required drop, and non-object/empty bodies.
 */
import * as assert from 'node:assert';
import { normalizeDriftDbIssues } from '../../../modules/integrations/drift-advisor-issues-fetch';

suite('normalizeDriftDbIssues (DB_18 Phase 2)', () => {
    test('maps an index-suggestion entry including suggestedSql and column', () => {
        const out = normalizeDriftDbIssues({
            issues: [{
                source: 'index-suggestion',
                severity: 'warning',
                table: 'contacts',
                column: 'email',
                message: 'contacts.email: frequent lookups without an index',
                suggestedSql: 'CREATE INDEX idx_contacts_email ON contacts(email);',
                priority: 'high',
            }],
        });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].source, 'index-suggestion');
        assert.strictEqual(out[0].severity, 'warning');
        assert.strictEqual(out[0].table, 'contacts');
        assert.strictEqual(out[0].column, 'email');
        assert.strictEqual(out[0].suggestedSql, 'CREATE INDEX idx_contacts_email ON contacts(email);');
        assert.strictEqual(out[0].priority, 'high');
    });

    test('maps an anomaly entry with defaults for missing optional fields', () => {
        const out = normalizeDriftDbIssues({
            issues: [{ source: 'anomaly', table: 'orders', message: '3 orphaned rows' }],
        });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].severity, 'info', 'severity defaults to info');
        assert.strictEqual(out[0].suggestedSql, undefined);
        assert.strictEqual(out[0].column, undefined);
    });

    test('drops entries without a usable message', () => {
        const out = normalizeDriftDbIssues({ issues: [{ table: 't' }, { message: '' }, { message: 'kept' }] });
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].message, 'kept');
    });

    test('non-object / missing-issues bodies normalize to an empty list', () => {
        assert.deepStrictEqual(normalizeDriftDbIssues(null), []);
        assert.deepStrictEqual(normalizeDriftDbIssues('nope'), []);
        assert.deepStrictEqual(normalizeDriftDbIssues({}), []);
        assert.deepStrictEqual(normalizeDriftDbIssues({ issues: 'not-an-array' }), []);
    });
});
