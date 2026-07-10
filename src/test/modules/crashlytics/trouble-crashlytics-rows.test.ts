import * as assert from 'node:assert';
import { troubleCrashlyticsRowsFromIssues } from '../../../modules/crashlytics/trouble-crashlytics-rows';
import type { CrashlyticsIssue } from '../../../modules/crashlytics/crashlytics-types';

/**
 * Trouble Mode Crashlytics band (Stage 5) — the pure row mapper.
 *
 * Contract: archived issues are dropped (the user's "don't show me again" set), the
 * busiest issues lead (event count desc), the list is capped, and counts are
 * stringified so the row's data-* attributes feed the existing detail overlay's meta.
 */
function issue(over: Partial<CrashlyticsIssue> & { id: string; eventCount: number }): CrashlyticsIssue {
  return {
    id: over.id,
    title: over.title ?? ('Issue ' + over.id),
    subtitle: over.subtitle ?? '',
    eventCount: over.eventCount,
    userCount: over.userCount ?? 0,
    isFatal: over.isFatal ?? false,
    kind: over.kind,
    state: over.state ?? 'OPEN',
    firstVersion: over.firstVersion,
    lastVersion: over.lastVersion,
  };
}

suite('Trouble Mode Crashlytics band — row mapper', () => {
  test('drops archived issues, sorts busiest-first, and stringifies counts', () => {
    const issues = [
      issue({ id: 'a', eventCount: 10, userCount: 3 }),
      issue({ id: 'b', eventCount: 50, userCount: 20, isFatal: true }),
      issue({ id: 'c', eventCount: 30, userCount: 9 }),
    ];
    const rows = troubleCrashlyticsRowsFromIssues(issues, ['a']);
    assert.deepStrictEqual(rows.map(r => r.id), ['b', 'c'], 'archived a dropped; b before c by event count');
    assert.strictEqual(rows[0].events, '50', 'events stringified');
    assert.strictEqual(rows[0].users, '20', 'users stringified');
    assert.strictEqual(rows[0].fatal, true, 'fatal flag carried');
  });

  test('caps the list to the requested size', () => {
    const issues = Array.from({ length: 40 }, (_v, i) => issue({ id: 'i' + i, eventCount: i }));
    const rows = troubleCrashlyticsRowsFromIssues(issues, [], 15);
    assert.strictEqual(rows.length, 15, 'capped at 15');
    assert.strictEqual(rows[0].id, 'i39', 'busiest first survives the cap');
  });

  test('empty input yields no rows', () => {
    assert.strictEqual(troubleCrashlyticsRowsFromIssues([], []).length, 0);
  });
});
