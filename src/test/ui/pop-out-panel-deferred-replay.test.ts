import * as assert from 'node:assert';
import { filterDeferredLinesAfterSnapshot } from '../../ui/viewer-panels/pop-out-panel-deferred-replay';

suite('pop-out panel deferred replay (hydration)', () => {
  test('without file snapshot replays all deferred lines (sidebar had no current log URI)', () => {
    const deferred = [{ lineCount: 1 }, { lineCount: 2 }, { lineCount: 3 }];
    const out = filterDeferredLinesAfterSnapshot(deferred, undefined);
    assert.deepStrictEqual(out, deferred);
    assert.notStrictEqual(out, deferred, 'expected a shallow copy');
  });

  test('with snapshot replays only lines strictly after loaded content length', () => {
    const deferred = [
      { lineCount: 8, id: 'a' },
      { lineCount: 9, id: 'b' },
      { lineCount: 10, id: 'c' },
      { lineCount: 11, id: 'd' },
    ];
    const out = filterDeferredLinesAfterSnapshot(deferred, 10);
    assert.deepStrictEqual(
      out.map((x) => x.id),
      ['d'],
      'lines 8–10 are assumed already in the file read; 11 is new',
    );
  });

  test('empty deferred stays empty', () => {
    assert.deepStrictEqual(filterDeferredLinesAfterSnapshot([], 5), []);
  });
});
