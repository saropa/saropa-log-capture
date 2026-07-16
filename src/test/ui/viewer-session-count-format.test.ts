/**
 * Tests for Logs-panel count formatting (`groupThousands`) and its load-order
 * dependency.
 *
 * `groupThousands` lives in the session-transforms webview chunk and is called
 * cross-chunk by the session-panel rendering scripts (severity pills, day/pinned
 * headings, +N group/child badges, +N older badge, pagination line). Two things
 * must hold and are pinned here:
 *   1. It coerces defensively — a malformed count (undefined/NaN/Infinity/float)
 *      never renders "NaN"/"∞" inside a pill; large ints get comma separators.
 *   2. The transforms chunk is composed BEFORE the session-panel chunk in the
 *      assembled webview scripts, so the helper is defined when the panel calls it.
 *      A reorder here would silently blank the panel at runtime — this test turns
 *      that into a compile-time-adjacent failure instead.
 */
import * as assert from 'assert';
import * as vm from 'vm';
import { getSessionTransformsScript } from '../../ui/viewer/viewer-session-transforms';
import { getViewerScriptTags } from '../../ui/provider/viewer-content-scripts';

/** Boot only the transforms chunk in a bare sandbox and return its groupThousands. */
function loadGroupThousands(): (n: unknown) => string {
    const sandbox: Record<string, unknown> = {};
    vm.createContext(sandbox);
    vm.runInContext(getSessionTransformsScript(), sandbox);
    const fn = sandbox.groupThousands;
    assert.strictEqual(typeof fn, 'function', 'groupThousands must be defined by the transforms chunk');
    return fn as (n: unknown) => string;
}

suite('Logs-panel count formatting', () => {
    test('groupThousands inserts comma separators at the thousand boundary', () => {
        const g = loadGroupThousands();
        assert.strictEqual(g(999), '999', 'sub-thousand values are unchanged');
        assert.strictEqual(g(1000), '1,000', 'separator appears at 1,000');
        assert.strictEqual(g(12480), '12,480', 'five-figure count is grouped');
        assert.strictEqual(g(1234567), '1,234,567', 'every thousand boundary is grouped');
    });

    test('groupThousands degrades malformed input to "0" instead of NaN/Infinity', () => {
        const g = loadGroupThousands();
        assert.strictEqual(g(undefined), '0', 'undefined count → 0, never "undefined"');
        assert.strictEqual(g('50' as unknown), '0', 'a string count → 0, never coerced-arithmetic surprise');
        assert.strictEqual(g(NaN), '0', 'NaN residual → 0, never "NaN" in a pill');
        assert.strictEqual(g(Infinity), '0', 'Infinity → 0, never "∞" in a pill');
    });

    test('groupThousands truncates a fractional count to an integer', () => {
        const g = loadGroupThousands();
        assert.strictEqual(g(1200.9), '1,200', 'fractional counts are truncated, then grouped');
    });

    test('transforms chunk is composed before the session-panel chunk that calls it', () => {
        const tags = getViewerScriptTags({ nonce: 'test-nonce', viewerMaxLines: 1000 });
        const helperAt = tags.indexOf('function groupThousands');
        // renderOlderBadge is defined inside the session-panel rendering scripts and
        // calls groupThousands — a stable marker for "the panel chunk that depends on it".
        const callerAt = tags.indexOf('function renderOlderBadge');
        assert.ok(helperAt >= 0, 'groupThousands must be present in the assembled scripts');
        assert.ok(callerAt >= 0, 'the session-panel caller must be present');
        assert.ok(helperAt < callerAt, 'groupThousands must be defined before the panel scripts that call it');
    });
});
