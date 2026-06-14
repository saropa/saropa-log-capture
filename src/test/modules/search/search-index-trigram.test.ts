import * as assert from 'assert';
import {
    containsAllTrigrams,
    decodeTrigrams,
    encodeTrigrams,
    extractTrigrams,
    MIN_TRIGRAM_QUERY_LENGTH,
} from '../../../modules/search/search-index-trigram';

suite('search-index-trigram', () => {

    test('extractTrigrams returns one trigram for a 3-char string', () => {
        const tris = extractTrigrams('abc');
        assert.strictEqual(tris.length, 1);
        // 'a'=97 'b'=98 'c'=99 → (97<<16)|(98<<8)|99
        assert.strictEqual(tris[0], (97 << 16) | (98 << 8) | 99);
    });

    test('extractTrigrams is case-insensitive (lowercased)', () => {
        assert.deepStrictEqual([...extractTrigrams('ABC')], [...extractTrigrams('abc')]);
    });

    test('extractTrigrams dedupes and sorts ascending', () => {
        const tris = extractTrigrams('ababab');
        // Distinct trigrams in 'ababab' are 'aba' and 'bab' → 2 entries, sorted.
        assert.strictEqual(tris.length, 2);
        assert.ok(tris[0] < tris[1], 'trigrams must be sorted ascending for binary search');
    });

    test('extractTrigrams returns empty for input shorter than a trigram', () => {
        assert.strictEqual(extractTrigrams('').length, 0);
        assert.strictEqual(extractTrigrams('ab').length, 0);
        assert.strictEqual('ab'.length < MIN_TRIGRAM_QUERY_LENGTH, true);
    });

    test('encode/decode round-trips a trigram set exactly', () => {
        const original = extractTrigrams('the quick brown fox');
        const restored = decodeTrigrams(encodeTrigrams(original));
        assert.deepStrictEqual([...restored], [...original]);
    });

    test('containsAllTrigrams: a file containing the query has all query trigrams', () => {
        // Correctness invariant: any file with the literal substring has every query trigram,
        // so narrowLiteral can never prune a file that actually matches.
        const fileTris = extractTrigrams('2026-06-14 NullPointerException at Foo.bar');
        const queryTris = extractTrigrams('NullPointer');
        assert.strictEqual(containsAllTrigrams(fileTris, queryTris), true);
    });

    test('containsAllTrigrams: a file missing a query trigram is pruned', () => {
        const fileTris = extractTrigrams('all clear, no issues this run');
        const queryTris = extractTrigrams('NullPointer');
        assert.strictEqual(containsAllTrigrams(fileTris, queryTris), false);
    });

    test('containsAllTrigrams: empty required set is trivially satisfied', () => {
        const fileTris = extractTrigrams('anything');
        assert.strictEqual(containsAllTrigrams(fileTris, new Uint32Array(0)), true);
    });

    test('containsAllTrigrams handles multibyte UTF-8 without throwing', () => {
        const fileTris = extractTrigrams('café — naïve façade');
        const queryTris = extractTrigrams('café');
        assert.strictEqual(containsAllTrigrams(fileTris, queryTris), true);
    });
});
