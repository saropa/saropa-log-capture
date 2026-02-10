import * as assert from 'assert';
import { formatRelativeTime } from '../ui/session-display';

suite('session-display', () => {
    suite('formatRelativeTime', () => {
        test('should return "(just now)" for timestamps < 1 min ago', () => {
            const now = Date.now();
            assert.strictEqual(formatRelativeTime(now), '(just now)');
            assert.strictEqual(formatRelativeTime(now - 30_000), '(just now)');
        });

        test('should return "(1 min ago)" for 1 minute ago', () => {
            assert.strictEqual(formatRelativeTime(Date.now() - 60_000), '(1 min ago)');
        });

        test('should return "(X min ago)" for 2-59 minutes ago', () => {
            assert.strictEqual(formatRelativeTime(Date.now() - 5 * 60_000), '(5 min ago)');
            assert.strictEqual(formatRelativeTime(Date.now() - 59 * 60_000), '(59 min ago)');
        });

        test('should return "(1 hr ago)" for 1 hour ago', () => {
            assert.strictEqual(formatRelativeTime(Date.now() - 60 * 60_000), '(1 hr ago)');
            assert.strictEqual(formatRelativeTime(Date.now() - 89 * 60_000), '(1 hr ago)');
        });

        test('should return "(X hrs ago)" for 2-23 hours ago', () => {
            assert.strictEqual(formatRelativeTime(Date.now() - 2 * 3_600_000), '(2 hrs ago)');
            assert.strictEqual(formatRelativeTime(Date.now() - 23 * 3_600_000), '(23 hrs ago)');
        });

        test('should return empty string for >= 24 hours ago', () => {
            assert.strictEqual(formatRelativeTime(Date.now() - 24 * 3_600_000), '');
            assert.strictEqual(formatRelativeTime(Date.now() - 48 * 3_600_000), '');
        });

        test('should return empty string for future timestamps', () => {
            assert.strictEqual(formatRelativeTime(Date.now() + 60_000), '');
        });
    });
});
