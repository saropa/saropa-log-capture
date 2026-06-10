import * as assert from 'assert';
import { compareThreeSessions } from '../../../modules/compare/session-compare';
import { renderThreeWayMarkdown } from '../../../modules/compare/session-compare-markdown';

suite('compareThreeSessions', () => {
    test('buckets lines by presence across A/B/C', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['shared', 'onlyA'],
            linesB: ['shared', 'onlyB'],
            linesC: ['shared', 'onlyC'],
        });
        assert.deepStrictEqual(r.buckets.ABC, ['shared']);
        assert.deepStrictEqual(r.buckets.A, ['onlyA']);
        assert.deepStrictEqual(r.buckets.B, ['onlyB']);
        assert.deepStrictEqual(r.buckets.C, ['onlyC']);
        assert.strictEqual(r.summary.counts.ABC, 1);
    });

    test('pairwise presence (AB / AC / BC) is computed correctly', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['ab', 'ac'],
            linesB: ['ab', 'bc'],
            linesC: ['ac', 'bc'],
        });
        assert.deepStrictEqual(r.buckets.AB, ['ab']);
        assert.deepStrictEqual(r.buckets.AC, ['ac']);
        assert.deepStrictEqual(r.buckets.BC, ['bc']);
    });

    test('normalization ignores leading timestamps so the same event matches across runs', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['[10:00:00.123] booting up'],
            linesB: ['[10:05:42.999] booting up'],
            linesC: ['[11:30:00.001] booting up'],
        });
        assert.strictEqual(r.buckets.ABC.length, 1, 'same line at different times is shared');
    });

    test('new errors in B/C vs baseline are detected via the default error regex', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['app started ok'],
            linesB: ['app started ok', 'ERROR: null check failed'],
            linesC: ['app started ok', 'Exception: socket closed'],
        });
        assert.strictEqual(r.summary.newErrorsB.length, 1);
        assert.ok(r.summary.newErrorsB[0].includes('null check failed'));
        assert.strictEqual(r.summary.newErrorsC.length, 1);
        assert.ok(r.summary.newErrorsC[0].includes('socket closed'));
    });

    test('errors present in baseline but gone from both runs are "resolved"', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['ERROR: legacy crash', 'common'],
            linesB: ['common'],
            linesC: ['common'],
        });
        assert.strictEqual(r.summary.resolvedErrors.length, 1);
        assert.ok(r.summary.resolvedErrors[0].includes('legacy crash'));
    });

    test('a custom isError predicate overrides the default', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['baseline'],
            linesB: ['baseline', 'WARN: retrying'],
            linesC: ['baseline'],
            isError: (t) => /warn/i.test(t),
        });
        assert.strictEqual(r.summary.newErrorsB.length, 1, 'custom predicate flags the WARN line');
    });

    test('blank / whitespace-only lines are ignored', () => {
        const r = compareThreeSessions({
            labelA: 'a', labelB: 'b', labelC: 'c',
            linesA: ['', '   ', 'real'],
            linesB: ['real'],
            linesC: ['real'],
        });
        assert.strictEqual(r.buckets.ABC.length, 1);
        assert.strictEqual(r.buckets.A.length, 0, 'blank lines do not become A-only entries');
    });
});

suite('renderThreeWayMarkdown', () => {
    const result = compareThreeSessions({
        labelA: 'base.log', labelB: 'runB.log', labelC: 'runC.log',
        linesA: ['common', 'ERROR: old'],
        linesB: ['common', 'ERROR: new in b'],
        linesC: ['common'],
    });

    test('leads with the triage summary and labels each session', () => {
        const md = renderThreeWayMarkdown(result);
        assert.ok(md.startsWith('# 3-way session comparison'), 'titled report');
        assert.ok(md.includes('**A (baseline):** base.log'));
        assert.ok(md.includes('## Triage summary'));
        assert.ok(md.indexOf('## Triage summary') < md.indexOf('## Line presence'),
            'summary precedes the per-bucket detail');
    });

    test('reports the error deltas with their counts', () => {
        const md = renderThreeWayMarkdown(result);
        assert.ok(md.includes('New errors in B (1)'), 'B introduced one error');
        assert.ok(md.includes('new in b'));
        assert.ok(md.includes('Errors resolved vs baseline (1)'), 'baseline error gone from both runs');
        assert.ok(md.includes('ERROR: old'));
    });

    test('empty buckets render a "(none)" placeholder, not a broken fence', () => {
        const md = renderThreeWayMarkdown(result);
        assert.ok(md.includes('_(none)_'), 'an empty bucket shows the placeholder');
    });
});
