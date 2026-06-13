import * as assert from 'node:assert';
import test from 'node:test';
import type { RecurringSignalEntry, SignalKind, SignalSeverity } from '../../../modules/misc/recurring-signal-builder';
import {
  buildEnvelope,
  isInScopeV1,
  mapCategory,
  mapSeverity,
  signalToDiagnostic,
  signalsToDiagnostics,
} from '../../../modules/diagnostics/signal-to-diagnostic';

/** Minimal valid signal — only the fields the serializer reads need realistic values. */
function makeSignal(over: Partial<RecurringSignalEntry> & { kind: SignalKind; severity: SignalSeverity }): RecurringSignalEntry {
  return {
    fingerprint: 'fp',
    label: 'label',
    sessionCount: 1,
    totalOccurrences: 1,
    firstSeen: '2026-06-13',
    lastSeen: '2026-06-13',
    recurring: false,
    timeline: [{ session: '2026-06-13', count: 1 }],
    ...over,
  };
}

test('mapSeverity collapses the four internal levels into the suite triple', () => {
  assert.strictEqual(mapSeverity('critical'), 'error');
  assert.strictEqual(mapSeverity('high'), 'error');
  assert.strictEqual(mapSeverity('medium'), 'warning');
  assert.strictEqual(mapSeverity('low'), 'info');
});

test('mapCategory routes SQL to drift and timing kinds to performance', () => {
  assert.strictEqual(mapCategory('sql', undefined, false), 'drift');
  assert.strictEqual(mapCategory('perf', undefined, false), 'performance');
  assert.strictEqual(mapCategory('slow-op', undefined, false), 'performance');
  assert.strictEqual(mapCategory('network', undefined, false), 'performance');
  assert.strictEqual(mapCategory('permission', undefined, false), 'security');
  assert.strictEqual(mapCategory('error', undefined, false), 'other');
});

test('mapCategory treats crash categories and ANR as crash', () => {
  assert.strictEqual(mapCategory('error', 'fatal', false), 'crash');
  assert.strictEqual(mapCategory('error', 'oom', false), 'crash');
  assert.strictEqual(mapCategory('anr', undefined, false), 'crash');
  assert.strictEqual(mapCategory('error', undefined, true), 'crash');
});

test('signalToDiagnostic maps a SQL signal to a drift diagnostic with sql + table', () => {
  const sql = 'SELECT * FROM contacts WHERE id = ?';
  const d = signalToDiagnostic(makeSignal({ kind: 'sql', severity: 'high', fingerprint: sql, label: 'Slow query' }), {
    commitSha: 'abc123',
  });
  assert.strictEqual(d.source, 'log-capture');
  assert.strictEqual(d.category, 'drift');
  assert.strictEqual(d.severity, 'error');
  assert.strictEqual(d.sql, sql);
  assert.strictEqual(d.table, 'contacts');
  assert.strictEqual(d.commitSha, 'abc123');
  assert.strictEqual(d.ruleId, undefined);
  assert.strictEqual(d.id, `sql:${sql}`);
});

test('signalToDiagnostic stamps a crash ruleId when the text matches a crash family', () => {
  const d = signalToDiagnostic(
    makeSignal({ kind: 'error', severity: 'critical', label: 'Bad state: No element', category: 'fatal' }),
    {},
  );
  assert.strictEqual(d.category, 'crash');
  assert.strictEqual(d.ruleId, 'crash:state-error-no-element');
  assert.strictEqual(d.severity, 'error');
});

test('signalToDiagnostic leaves sql/table/ruleId unset for a plain non-crash error', () => {
  const d = signalToDiagnostic(makeSignal({ kind: 'error', severity: 'medium', label: 'Connection retry' }), {});
  assert.strictEqual(d.category, 'other');
  assert.strictEqual(d.sql, undefined);
  assert.strictEqual(d.table, undefined);
  assert.strictEqual(d.ruleId, undefined);
});

test('isInScopeV1 keeps drift/crash/performance and drops other/security', () => {
  const drift = signalToDiagnostic(makeSignal({ kind: 'sql', severity: 'low', fingerprint: 'SELECT 1' }), {});
  const other = signalToDiagnostic(makeSignal({ kind: 'error', severity: 'low', label: 'noise' }), {});
  const security = signalToDiagnostic(makeSignal({ kind: 'permission', severity: 'low' }), {});
  assert.strictEqual(isInScopeV1(drift), true);
  assert.strictEqual(isInScopeV1(other), false);
  assert.strictEqual(isInScopeV1(security), false);
});

test('signalsToDiagnostics filters to in-scope categories by default', () => {
  const signals = [
    makeSignal({ kind: 'sql', severity: 'low', fingerprint: 'SELECT 1' }),
    makeSignal({ kind: 'error', severity: 'low', label: 'noise' }),
  ];
  assert.strictEqual(signalsToDiagnostics(signals, {}).length, 1);
  assert.strictEqual(signalsToDiagnostics(signals, {}, true).length, 2);
});

test('buildEnvelope wraps diagnostics with schemaVersion, producer, and generatedAt', () => {
  const env = buildEnvelope([], { name: 'saropa-log-capture', version: '1.2.3' }, '2026-06-13T00:00:00.000Z');
  assert.strictEqual(env.schemaVersion, 1);
  assert.strictEqual(env.producer.version, '1.2.3');
  assert.strictEqual(env.generatedAt, '2026-06-13T00:00:00.000Z');
  assert.deepStrictEqual(env.diagnostics, []);
});
