import * as assert from 'assert';
import { classifyLevel } from '../../../modules/analysis/level-classifier';

/**
 * Regression guard for issue #30 (high CPU / unresponsive host).
 *
 * `strictStructuralErrorPattern` once began with `\w*(?:Error|Exception)…`. The leading
 * `\w*` was redundant for an unanchored `.test()` but backtracked quadratically: on a long
 * unbroken run of word characters (a base64 blob, hash, or minified-JSON line) the engine
 * re-consumed the run at every start offset. A single 50 KB line took ~2.3 s; the deferred
 * severity scan over a large log pegged the extension host. The fix drops the `\w*`.
 *
 * These inputs would each take multiple seconds under the old pattern; the fixed pattern
 * runs in well under a millisecond. The 1 s budget is ~3 orders of magnitude above the
 * fixed cost, so it is a true catastrophic-backtracking detector, not a flaky micro-timer.
 */
suite('LevelClassifier (catastrophic backtracking guard — issue #30)', () => {

    const underBudget = (line: string): void => {
        const start = Date.now();
        classifyLevel(line, 'stdout', true);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 1000, `classifyLevel took ${elapsed}ms (expected < 1000ms — regex backtracking?)`);
    };

    test('should classify a 100k-char word-run line quickly', () => {
        underBudget('a'.repeat(100_000));
    });

    test('should classify a 100k-char letters+digits run quickly', () => {
        underBudget('abc123'.repeat(16_666));
    });

    test('should classify a long _PascalCase-prefixed run quickly', () => {
        // Exercises the second alternative `_[A-Z]\w*(?:Error|Exception)\b`, which keeps
        // its `\w*` but is anchored by `_[A-Z]` so it stays single-pass O(n).
        underBudget('_A' + 'a'.repeat(100_000));
    });
});
