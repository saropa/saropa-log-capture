import * as assert from 'node:assert';
import test from 'node:test';
import { parseDiagnostic, parseEnvelope } from '../../../modules/diagnostics/envelope-parse';

const validDiagnostic = {
  id: 'advisor:missing-index:contacts',
  source: 'advisor',
  severity: 'warning',
  category: 'drift',
  title: 'Missing index on contacts.email',
};

function envelopeText(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    producer: { name: 'saropa_drift_advisor', version: '3.7.3' },
    generatedAt: '2026-06-13T00:00:00.000Z',
    diagnostics: [validDiagnostic],
    ...over,
  });
}

test('parseEnvelope reads a well-formed envelope', () => {
  const env = parseEnvelope(envelopeText());
  assert.ok(env);
  assert.strictEqual(env.producer.name, 'saropa_drift_advisor');
  assert.strictEqual(env.diagnostics.length, 1);
  assert.strictEqual(env.diagnostics[0].category, 'drift');
});

test('parseEnvelope returns undefined for non-JSON', () => {
  assert.strictEqual(parseEnvelope('{ not json'), undefined);
});

test('parseEnvelope refuses a higher schema major', () => {
  assert.strictEqual(parseEnvelope(envelopeText({ schemaVersion: 2 })), undefined);
});

test('parseEnvelope refuses a missing diagnostics array', () => {
  assert.strictEqual(parseEnvelope(JSON.stringify({ schemaVersion: 1 })), undefined);
});

test('parseEnvelope drops malformed diagnostics but keeps valid ones', () => {
  const env = parseEnvelope(
    envelopeText({ diagnostics: [validDiagnostic, { id: 'x' }, { source: 'advisor' }, 42] }),
  );
  assert.ok(env);
  assert.strictEqual(env.diagnostics.length, 1);
});

test('parseEnvelope tolerates a missing producer block', () => {
  const env = parseEnvelope(envelopeText({ producer: undefined }));
  assert.ok(env);
  assert.strictEqual(env.producer.name, 'unknown');
});

test('parseDiagnostic rejects an unknown source/severity/category', () => {
  assert.strictEqual(parseDiagnostic({ ...validDiagnostic, source: 'bogus' }), undefined);
  assert.strictEqual(parseDiagnostic({ ...validDiagnostic, severity: 'fatal' }), undefined);
  assert.strictEqual(parseDiagnostic({ ...validDiagnostic, category: 'nonsense' }), undefined);
});

test('parseDiagnostic passes through optional sql/table/fix when valid', () => {
  const d = parseDiagnostic({
    ...validDiagnostic,
    sql: 'SELECT * FROM contacts',
    table: 'contacts',
    fix: { kind: 'command', title: 'Open EXPLAIN', command: 'driftViewer.openExplainForSql', args: [{ sql: 'x' }] },
  });
  assert.ok(d);
  assert.strictEqual(d.sql, 'SELECT * FROM contacts');
  assert.strictEqual(d.fix?.command, 'driftViewer.openExplainForSql');
  assert.strictEqual(d.fix?.args?.length, 1);
});

test('parseDiagnostic drops a fix that lacks kind/title', () => {
  const d = parseDiagnostic({ ...validDiagnostic, fix: { command: 'x' } });
  assert.ok(d);
  assert.strictEqual(d.fix, undefined);
});
