import * as assert from 'assert';
import type { LintViolation } from '../../../modules/misc/lint-violation-reader';
import {
    buildOwaspSummaries,
    formatOwaspSection,
    countOwaspCategories,
} from '../../../modules/bug-report/bug-report-owasp-section';

function violation(overrides: Partial<LintViolation> = {}): LintViolation {
    return {
        file: overrides.file ?? 'lib/auth.dart',
        line: overrides.line ?? 1,
        rule: overrides.rule ?? 'test_rule',
        message: overrides.message ?? 'test message',
        severity: overrides.severity ?? 'error',
        impact: overrides.impact ?? 'critical',
        owasp: overrides.owasp ?? { mobile: [], web: [] },
    };
}

suite('buildOwaspSummaries', () => {
    test('should aggregate violations by OWASP category', () => {
        const matches = [
            violation({ rule: 'r1', owasp: { mobile: ['m1'], web: [] } }),
            violation({ rule: 'r2', owasp: { mobile: ['m1', 'm9'], web: [] } }),
            violation({ rule: 'r3', owasp: { mobile: [], web: ['a03'] } }),
        ];
        const summaries = buildOwaspSummaries(matches);
        assert.strictEqual(summaries.length, 3);
        // m1 has count 2, should be first
        assert.strictEqual(summaries[0].id, 'm1');
        assert.strictEqual(summaries[0].count, 2);
        assert.deepStrictEqual(summaries[0].rules, ['r1', 'r2']);
    });

    test('should dedup rules within a category', () => {
        const matches = [
            violation({ rule: 'same_rule', owasp: { mobile: ['m1'], web: [] } }),
            violation({ rule: 'same_rule', owasp: { mobile: ['m1'], web: [] } }),
        ];
        const summaries = buildOwaspSummaries(matches);
        assert.strictEqual(summaries.length, 1);
        assert.strictEqual(summaries[0].count, 2);
        assert.deepStrictEqual(summaries[0].rules, ['same_rule']);
    });

    test('should return empty array when no violations have OWASP data', () => {
        const matches = [
            violation({ owasp: { mobile: [], web: [] } }),
            violation({ owasp: { mobile: [], web: [] } }),
        ];
        assert.strictEqual(buildOwaspSummaries(matches).length, 0);
    });

    test('should count multi-category violations under each category', () => {
        const matches = [
            violation({ owasp: { mobile: ['m1', 'm9'], web: ['a03'] } }),
        ];
        const summaries = buildOwaspSummaries(matches);
        assert.strictEqual(summaries.length, 3);
        const ids = summaries.map(s => s.id).sort();
        assert.deepStrictEqual(ids, ['a03', 'm1', 'm9']);
    });

    test('should use fallback label for unknown OWASP IDs', () => {
        const matches = [
            violation({ owasp: { mobile: ['m99'], web: [] } }),
        ];
        const summaries = buildOwaspSummaries(matches);
        assert.strictEqual(summaries[0].label, 'M99');
    });

    test('should sort by count descending then by ID', () => {
        const matches = [
            violation({ owasp: { mobile: [], web: ['a03'] } }),
            violation({ owasp: { mobile: ['m9'], web: [] } }),
            violation({ owasp: { mobile: ['m9'], web: [] } }),
        ];
        const summaries = buildOwaspSummaries(matches);
        assert.strictEqual(summaries[0].id, 'm9');
        assert.strictEqual(summaries[1].id, 'a03');
    });
});

suite('formatOwaspSection', () => {
    test('should return undefined when no OWASP violations exist', () => {
        const matches = [violation({ owasp: { mobile: [], web: [] } })];
        assert.strictEqual(formatOwaspSection(matches), undefined);
    });

    test('should show crash file phrasing when primaryFile matches', () => {
        const matches = [
            violation({ file: 'lib/auth.dart', owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = formatOwaspSection(matches, 'lib/auth.dart');
        assert.ok(result);
        assert.ok(result.includes('## Security Context'));
        assert.ok(result.includes('Crash file `auth.dart`'));
        assert.ok(result.includes('1 OWASP-mapped violation'));
    });

    test('should show stack trace phrasing when primaryFile has no OWASP violations', () => {
        const matches = [
            violation({ file: 'lib/other.dart', owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = formatOwaspSection(matches, 'lib/auth.dart');
        assert.ok(result);
        assert.ok(result.includes('found in files appearing in this stack trace'));
    });

    test('should show affected files phrasing when no primaryFile', () => {
        const matches = [
            violation({ owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = formatOwaspSection(matches);
        assert.ok(result);
        assert.ok(result.includes('found in affected files'));
    });

    test('should include category table with rows on consecutive lines', () => {
        const matches = [
            violation({ rule: 'r1', owasp: { mobile: ['m1'], web: [] } }),
            violation({ rule: 'r2', owasp: { mobile: [], web: ['a03'] } }),
        ];
        const result = formatOwaspSection(matches)!;
        assert.ok(result.includes('| **M1: Improper Credential Usage** | 1 | r1 |'));
        assert.ok(result.includes('| **A03: Injection** | 1 | r2 |'));
        // Table header, separator, and rows must be on consecutive lines
        assert.ok(result.includes(
            '| Category | Count | Rules |\n|----------|-------|-------|\n|',
        ));
    });

    test('should include callout', () => {
        const matches = [
            violation({ owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = formatOwaspSection(matches)!;
        assert.ok(result.includes('> These violations may be related to the crash.'));
    });
});

suite('countOwaspCategories', () => {
    test('should return zero count for violations without OWASP data', () => {
        const matches = [violation({ owasp: { mobile: [], web: [] } })];
        const result = countOwaspCategories(matches);
        assert.strictEqual(result.owaspViolationCount, 0);
        assert.strictEqual(result.owaspCategories, '');
    });

    test('should count violations and collect sorted category IDs', () => {
        const matches = [
            violation({ owasp: { mobile: ['m9'], web: ['a03'] } }),
            violation({ owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = countOwaspCategories(matches);
        assert.strictEqual(result.owaspViolationCount, 2);
        assert.strictEqual(result.owaspCategories, 'A03, M1, M9');
    });

    test('should dedup category IDs across violations', () => {
        const matches = [
            violation({ owasp: { mobile: ['m1'], web: [] } }),
            violation({ owasp: { mobile: ['m1'], web: [] } }),
        ];
        const result = countOwaspCategories(matches);
        assert.strictEqual(result.owaspViolationCount, 2);
        assert.strictEqual(result.owaspCategories, 'M1');
    });
});
