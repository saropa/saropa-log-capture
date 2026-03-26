import * as assert from 'node:assert';
import { parseSessionDate, filterByTime, type LoadedMeta } from '../../../modules/session/metadata-loader';
import type { SessionMeta } from '../../../modules/session/session-metadata';

/** Build a minimal LoadedMeta for testing filterByTime. */
function makeMeta(filename: string): LoadedMeta {
    return { filename, meta: { lineCount: 0 } as SessionMeta };
}

/** Format a Date into the `YYYYMMDD_HHMMSS` log filename prefix. */
function formatLogDatePrefix(date: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
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
        const dayMs = 24 * 60 * 60 * 1000;
        const fixedNow = new Date(2026, 2, 26, 12, 0, 0).getTime();
        const recent = makeMeta(`${formatLogDatePrefix(new Date(fixedNow - (5 * dayMs)))}_app.log`);

        test('should return all metas for "all" range', () => {
            const metas = [makeMeta('20200101_000000_old.log'), recent];
            const result = filterByTime(metas, 'all');
            assert.strictEqual(result.length, 2);
        });

        test('should filter out old sessions for 24h range', () => {
            const old = makeMeta('20200101_000000_ancient.log');
            const within24h = makeMeta(`${formatLogDatePrefix(new Date(fixedNow - (2 * 60 * 60 * 1000)))}_within.log`);
            const result = filterByTime([old, recent, within24h], '24h', fixedNow);
            // The old one from 2020 should definitely be filtered out
            assert.ok(!result.some(m => m.filename === '20200101_000000_ancient.log'));
            // A session from 2 hours ago should stay in the 24h window.
            assert.ok(result.some(m => m.filename === within24h.filename));
            // A session from 5 days ago should not remain in the 24h window.
            assert.ok(!result.some(m => m.filename === recent.filename));
        });

        test('should keep recent sessions for 30d range', () => {
            const result = filterByTime([recent], '30d', fixedNow);
            // A session from 5 days ago should pass the 30d filter.
            assert.strictEqual(result.length, 1);
        });

        test('should return empty for empty input', () => {
            const result = filterByTime([], '7d');
            assert.strictEqual(result.length, 0);
        });

        test('should filter out unparseable filenames', () => {
            const bad = makeMeta('not-a-date.log');
            const result = filterByTime([bad], '24h', fixedNow);
            // parseSessionDate returns 0 which is 1970 — always filtered out
            assert.strictEqual(result.length, 0);
        });
    });
});
