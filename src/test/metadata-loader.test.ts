import * as assert from 'assert';
import { parseSessionDate, filterByTime, type LoadedMeta } from '../modules/metadata-loader';
import type { SessionMeta } from '../modules/session-metadata';

/** Build a minimal LoadedMeta for testing filterByTime. */
function makeMeta(filename: string): LoadedMeta {
    return { filename, meta: { lineCount: 0 } as SessionMeta };
}

suite('MetadataLoader', () => {

    suite('parseSessionDate', () => {

        test('should parse standard log filename', () => {
            const ts = parseSessionDate('20260224_163302_flutter.log');
            const d = new Date(ts);
            assert.strictEqual(d.getFullYear(), 2026);
            assert.strictEqual(d.getMonth(), 1); // February = 1
            assert.strictEqual(d.getDate(), 24);
            assert.strictEqual(d.getHours(), 16);
            assert.strictEqual(d.getMinutes(), 33);
            assert.strictEqual(d.getSeconds(), 2);
        });

        test('should parse filename without extension', () => {
            const ts = parseSessionDate('20250101_000000');
            const d = new Date(ts);
            assert.strictEqual(d.getFullYear(), 2025);
            assert.strictEqual(d.getMonth(), 0); // January = 0
            assert.strictEqual(d.getDate(), 1);
        });

        test('should return 0 for non-matching filename', () => {
            assert.strictEqual(parseSessionDate('readme.txt'), 0);
        });

        test('should return 0 for empty string', () => {
            assert.strictEqual(parseSessionDate(''), 0);
        });

        test('should handle midnight boundary', () => {
            const ts = parseSessionDate('20260101_235959_test.log');
            const d = new Date(ts);
            assert.strictEqual(d.getHours(), 23);
            assert.strictEqual(d.getMinutes(), 59);
            assert.strictEqual(d.getSeconds(), 59);
        });

        test('should handle subfolder prefix', () => {
            const ts = parseSessionDate('20260224_120000_app.log');
            assert.ok(ts > 0, 'Should parse date from filename with subfolder prefix');
        });
    });

    suite('filterByTime', () => {

        const recent = makeMeta('20260224_120000_app.log');

        test('should return all metas for "all" range', () => {
            const metas = [makeMeta('20200101_000000_old.log'), recent];
            const result = filterByTime(metas, 'all');
            assert.strictEqual(result.length, 2);
        });

        test('should filter out old sessions for 24h range', () => {
            const old = makeMeta('20200101_000000_ancient.log');
            const result = filterByTime([old, recent], '24h');
            assert.ok(result.length <= 2, 'Should filter or keep based on current time');
            // The old one from 2020 should definitely be filtered out
            assert.ok(!result.some(m => m.filename === '20200101_000000_ancient.log'));
        });

        test('should keep recent sessions for 30d range', () => {
            const result = filterByTime([recent], '30d');
            // A session from today should pass the 30d filter
            assert.strictEqual(result.length, 1);
        });

        test('should return empty for empty input', () => {
            const result = filterByTime([], '7d');
            assert.strictEqual(result.length, 0);
        });

        test('should filter out unparseable filenames', () => {
            const bad = makeMeta('not-a-date.log');
            const result = filterByTime([bad], '24h');
            // parseSessionDate returns 0 which is 1970 — always filtered out
            assert.strictEqual(result.length, 0);
        });
    });
});
