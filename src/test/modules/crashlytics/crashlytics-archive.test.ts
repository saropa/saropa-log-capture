/**
 * Tests for the pure archived-id toggle that backs local issue archiving. Pins add (no duplicates),
 * remove, and idempotence so the on-disk archived set can't accumulate duplicates or fail to clear.
 *
 * Runs standalone via `node --test out/test/modules/crashlytics/crashlytics-archive.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { toggleArchivedId } from '../../../modules/crashlytics/crashlytics-archive';

test('toggleArchivedId: archiving adds the id once', () => {
    assert.deepStrictEqual(toggleArchivedId([], 'a', true), ['a']);
    assert.deepStrictEqual(toggleArchivedId(['a'], 'a', true), ['a'], 'no duplicate');
    assert.deepStrictEqual(toggleArchivedId(['a'], 'b', true), ['a', 'b']);
});

test('toggleArchivedId: unarchiving removes the id', () => {
    assert.deepStrictEqual(toggleArchivedId(['a', 'b'], 'a', false), ['b']);
    assert.deepStrictEqual(toggleArchivedId(['b'], 'a', false), ['b'], 'removing an absent id is a no-op');
});
