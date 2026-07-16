import * as assert from 'assert';
import { KeywordWatcher, WatchPatternConfig } from '../../../modules/features/keyword-watcher';

suite('KeywordWatcher', () => {

    function makeWatcher(configs: WatchPatternConfig[]): KeywordWatcher {
        return new KeywordWatcher(configs);
    }

    test('should match a simple string (case-insensitive)', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('Something Error happened');
        assert.strictEqual(hits.length, 1);
        assert.strictEqual(hits[0].label, 'error');
    });

    test('should not match when keyword is absent', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('All good here');
        assert.strictEqual(hits.length, 0);
    });

    test('should match multiple patterns on the same line', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'fatal', alert: 'flash' },
        ]);
        const hits = watcher.testLine('FATAL ERROR: something broke');
        assert.strictEqual(hits.length, 2);
    });

    test('should match regex pattern', () => {
        const watcher = makeWatcher([{ keyword: '/\\berr\\d+/i', alert: 'badge' }]);
        const hits = watcher.testLine('Got ERR42 from server');
        assert.strictEqual(hits.length, 1);
        assert.strictEqual(hits[0].alert, 'badge');
    });

    test('should not match invalid regex (gracefully skipped)', () => {
        const watcher = makeWatcher([{ keyword: '/[invalid/', alert: 'flash' }]);
        const hits = watcher.testLine('anything');
        assert.strictEqual(hits.length, 0);
    });

    test('should track hit counts correctly', () => {
        const watcher = makeWatcher([{ keyword: 'warn', alert: 'badge' }]);
        watcher.testLine('warning 1');
        watcher.testLine('no match');
        watcher.testLine('another warning');
        assert.strictEqual(watcher.getCounts().get('warn'), 2);
    });

    test('should reset counts to zero', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        watcher.testLine('error occurred');
        assert.strictEqual(watcher.getCounts().get('error'), 1);
        watcher.resetCounts();
        assert.strictEqual(watcher.getCounts().get('error'), 0);
    });

    test('should handle empty patterns list', () => {
        const watcher = makeWatcher([]);
        const hits = watcher.testLine('anything');
        assert.strictEqual(hits.length, 0);
    });

    test('should handle empty line', () => {
        const watcher = makeWatcher([{ keyword: 'error', alert: 'flash' }]);
        const hits = watcher.testLine('');
        assert.strictEqual(hits.length, 0);
    });

    test('should escape special regex characters in string patterns', () => {
        const watcher = makeWatcher([{ keyword: 'error()', alert: 'flash' }]);
        const hits = watcher.testLine('called error() method');
        assert.strictEqual(hits.length, 1);
    });

    test('getBadgeCount sums only patterns whose alert is badge', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'warning', alert: 'badge' },
            { keyword: 'info', alert: 'none' },
        ]);
        watcher.testLine('error and warning and info');
        watcher.testLine('another warning here');
        // Only the badge-alert 'warning' pattern (2 hits) counts; flash/none are excluded.
        assert.strictEqual(watcher.getBadgeCount(), 2);
    });

    test('getBadgeCount reads a repeated badge keyword slot once, not per entry', () => {
        // Two entries with the same keyword share one 'counts' slot. testLine increments that
        // slot once per matching entry (so a single line here stores 2). getBadgeCount must
        // read the slot once (2), not add it per duplicate entry (which would report 4).
        const watcher = makeWatcher([
            { keyword: 'warning', alert: 'badge' },
            { keyword: 'warning', alert: 'badge' },
        ]);
        watcher.testLine('warning here');
        assert.strictEqual(watcher.getCounts().get('warning'), 2);
        assert.strictEqual(watcher.getBadgeCount(), 2);
    });

    test('getBadgeCount is zero when no pattern uses the badge alert', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'info', alert: 'none' },
        ]);
        watcher.testLine('error and info');
        assert.strictEqual(watcher.getBadgeCount(), 0);
    });

    test('should report correct alert type per hit', () => {
        const watcher = makeWatcher([
            { keyword: 'error', alert: 'flash' },
            { keyword: 'warning', alert: 'badge' },
            { keyword: 'info', alert: 'none' },
        ]);
        const hits = watcher.testLine('error and warning and info');
        assert.strictEqual(hits.find(h => h.label === 'error')?.alert, 'flash');
        assert.strictEqual(hits.find(h => h.label === 'warning')?.alert, 'badge');
        assert.strictEqual(hits.find(h => h.label === 'info')?.alert, 'none');
    });
});
