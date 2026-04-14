import * as assert from 'assert';
import { formatRelativeTime, defaultDisplayOptions, normalizeFilename } from '../../../ui/session/session-display';

suite('session-display', () => {

    suite('defaultDisplayOptions', () => {
        test('includes dateRange with value "all"', () => {
            assert.strictEqual(defaultDisplayOptions.dateRange, 'all');
        });

        test('has all required display option fields', () => {
            assert.strictEqual(typeof defaultDisplayOptions.stripDatetime, 'boolean');
            assert.strictEqual(typeof defaultDisplayOptions.normalizeNames, 'boolean');
            assert.strictEqual(typeof defaultDisplayOptions.showDayHeadings, 'boolean');
            assert.strictEqual(typeof defaultDisplayOptions.reverseSort, 'boolean');
            assert.ok(typeof defaultDisplayOptions.dateRange === 'string', 'dateRange should be a string');
        });
    });
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

    suite('normalizeFilename', () => {
        test('should replace underscores with spaces and Title Case', () => {
            assert.strictEqual(normalizeFilename('my_app_name.log'), 'My App Name.log');
        });

        test('should replace hyphens with spaces and Title Case', () => {
            assert.strictEqual(normalizeFilename('my-app-name.log'), 'My App Name.log');
        });

        test('should replace dots with spaces and Title Case', () => {
            // Bug fix: "contacts.drift-advisor" was showing as "Contacts.drift Advisor"
            assert.strictEqual(
                normalizeFilename('contacts.drift-advisor.json'),
                'Contacts Drift Advisor.json',
            );
        });

        test('should handle mixed separators', () => {
            assert.strictEqual(
                normalizeFilename('my_app.sub-module.log'),
                'My App Sub Module.log',
            );
        });

        test('should collapse consecutive separators', () => {
            assert.strictEqual(normalizeFilename('foo__bar--baz.log'), 'Foo Bar Baz.log');
        });

        test('should preserve extension for known types', () => {
            assert.strictEqual(normalizeFilename('test.json'), 'Test.json');
            assert.strictEqual(normalizeFilename('test.log'), 'Test.log');
            assert.strictEqual(normalizeFilename('test.csv'), 'Test.csv');
        });

        test('should handle name with no known extension', () => {
            // No known extension — the whole string is the base
            assert.strictEqual(normalizeFilename('my_app'), 'My App');
        });

        test('should fall back to original base when separators produce empty string', () => {
            // Edge case: name is only separators plus extension — falls back to raw base
            assert.strictEqual(normalizeFilename('___.log'), '___.log');
        });
    });
});
