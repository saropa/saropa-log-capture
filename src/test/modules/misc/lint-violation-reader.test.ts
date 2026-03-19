import * as assert from 'assert';
import type { StackFrame } from '../../../modules/bug-report/bug-report-collector';
import type { LintReportData } from '../../../modules/misc/lint-violation-reader';
import { formatLintSection } from '../../../modules/bug-report/bug-report-lint-section';

/** Helper to build a minimal stack frame. */
function frame(filePath: string, line: number, isApp = true): StackFrame {
    return { text: `at ${filePath}:${line}`, isApp, sourceRef: { filePath, line } };
}

suite('formatLintSection', () => {
    function buildData(overrides: Partial<LintReportData> = {}): LintReportData {
        return {
            matches: overrides.matches ?? [{
                file: 'lib/auth.dart', line: 42, rule: 'require_field_dispose',
                message: 'TextEditingController is never disposed',
                severity: 'error', impact: 'critical',
                owasp: { mobile: ['m9'], web: [] },
            }],
            totalInExport: overrides.totalInExport ?? 1,
            tier: overrides.tier ?? 'comprehensive',
            version: overrides.version ?? '4.14.0',
            timestamp: overrides.timestamp ?? new Date().toISOString(),
            isStale: overrides.isStale ?? false,
            hasExtension: overrides.hasExtension ?? false,
            filesAnalyzed: overrides.filesAnalyzed ?? 50,
            byImpact: overrides.byImpact ?? {},
        };
    }

    test('should format single violation', () => {
        const result = formatLintSection(buildData());
        assert.ok(result.includes('## Known Lint Issues'));
        assert.ok(result.includes('1 lint violation found'));
        assert.ok(result.includes('require_field_dispose'));
        assert.ok(result.includes('critical'));
        assert.ok(result.includes('lib/auth.dart'));
    });

    test('should pluralize for multiple violations', () => {
        const data = buildData({
            matches: [
                { file: 'lib/a.dart', line: 1, rule: 'r1', message: 'msg1', severity: 'error', impact: 'critical', owasp: { mobile: [], web: [] } },
                { file: 'lib/b.dart', line: 2, rule: 'r2', message: 'msg2', severity: 'warning', impact: 'high', owasp: { mobile: [], web: [] } },
            ],
        });
        const result = formatLintSection(data);
        assert.ok(result.includes('2 lint violations found'));
    });

    test('should include source line with version and tier', () => {
        const result = formatLintSection(buildData({ version: '4.14.0', tier: 'professional' }));
        assert.ok(result.includes('saropa_lints v4.14.0'));
        assert.ok(result.includes('professional tier'));
    });

    test('should omit version when absent', () => {
        const data: LintReportData = {
            matches: [{ file: 'lib/a.dart', line: 1, rule: 'r1', message: 'msg', severity: 'info', impact: 'low', owasp: { mobile: [], web: [] } }],
            totalInExport: 1, tier: 'comprehensive', version: undefined,
            timestamp: new Date().toISOString(), isStale: false, hasExtension: false,
            filesAnalyzed: 50, byImpact: {},
        };
        const result = formatLintSection(data);
        assert.ok(result.includes('saropa_lints,'));
        assert.ok(!result.includes('saropa_lints v'));
    });

    test('should show CLI staleness warning when no extension', () => {
        const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const result = formatLintSection(buildData({ timestamp: old, isStale: true, hasExtension: false }));
        assert.ok(result.includes('may be stale'));
        assert.ok(result.includes('dart run custom_lint'));
        assert.ok(!result.includes('Saropa Lints'));
    });

    test('should show extension staleness warning when extension detected', () => {
        const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const result = formatLintSection(buildData({ timestamp: old, isStale: true, hasExtension: true }));
        assert.ok(result.includes('may be stale'));
        assert.ok(result.includes('Run analysis in Saropa Lints'));
        assert.ok(!result.includes('dart run custom_lint'));
    });

    test('should include impact breakdown when byImpact has non-zero counts', () => {
        const data = buildData({ byImpact: { critical: 2, high: 5, medium: 0, low: 3 } });
        const result = formatLintSection(data);
        assert.ok(result.includes('2 critical, 5 high, 3 low'));
        // Breakdown should appear before the violations count line.
        const breakdownIdx = result.indexOf('2 critical');
        const countIdx = result.indexOf('1 lint violation');
        assert.ok(breakdownIdx < countIdx, 'breakdown should appear before violation count');
    });

    test('should omit breakdown when byImpact is empty', () => {
        const result = formatLintSection(buildData({ byImpact: {} }));
        // The breakdown line would appear between the heading and the count line.
        // With empty byImpact, the count line should immediately follow the heading.
        const sections = result.split('\n\n');
        assert.strictEqual(sections[0], '## Known Lint Issues');
        assert.ok(sections[1].startsWith('1 lint violation'));
    });

    test('should not show staleness warning when fresh', () => {
        const result = formatLintSection(buildData({ isStale: false }));
        assert.ok(!result.includes('stale'));
    });

    test('should escape pipe characters in messages', () => {
        const data = buildData({
            matches: [{
                file: 'lib/a.dart', line: 1, rule: 'r1',
                message: 'value | must be checked', severity: 'info', impact: 'low',
                owasp: { mobile: [], web: [] },
            }],
        });
        const result = formatLintSection(data);
        assert.ok(result.includes('value \\| must be checked'));
    });

    test('should truncate long messages', () => {
        const longMsg = 'A'.repeat(200);
        const data = buildData({
            matches: [{
                file: 'lib/a.dart', line: 1, rule: 'r1',
                message: longMsg, severity: 'info', impact: 'low',
                owasp: { mobile: [], web: [] },
            }],
        });
        const result = formatLintSection(data);
        const tableRow = result.split('\n').find(l => l.includes('r1'));
        assert.ok(tableRow && tableRow.length < longMsg.length + 100);
    });

    test('should filter by impact level essential (critical + high only)', () => {
        const data = buildData({
            matches: [
                { file: 'lib/a.dart', line: 1, rule: 'r1', message: 'm1', severity: 'error', impact: 'critical', owasp: { mobile: [], web: [] } },
                { file: 'lib/b.dart', line: 2, rule: 'r2', message: 'm2', severity: 'warning', impact: 'high', owasp: { mobile: [], web: [] } },
                { file: 'lib/c.dart', line: 3, rule: 'r3', message: 'm3', severity: 'info', impact: 'medium', owasp: { mobile: [], web: [] } },
            ],
        });
        const result = formatLintSection(data, 'essential');
        assert.ok(result.includes('## Known Lint Issues (critical + high only)'));
        assert.ok(result.includes('2 lint violations found'));
        assert.ok(result.includes('r1') && result.includes('r2'));
        assert.ok(!result.includes('r3'));
    });

    test('should filter by impact level recommended and show up-to-medium label', () => {
        const data = buildData({
            matches: [
                { file: 'lib/a.dart', line: 1, rule: 'r1', message: 'm1', severity: 'info', impact: 'low', owasp: { mobile: [], web: [] } },
                { file: 'lib/b.dart', line: 2, rule: 'r2', message: 'm2', severity: 'warning', impact: 'medium', owasp: { mobile: [], web: [] } },
            ],
        });
        const result = formatLintSection(data, 'recommended');
        assert.ok(result.includes('## Known Lint Issues (up to medium)'));
        assert.ok(result.includes('1 lint violation found'));
        assert.ok(result.includes('r2'));
        assert.ok(!result.includes('r1'));
    });

    test('should show no suffix for impact level full', () => {
        const result = formatLintSection(buildData(), 'full');
        assert.strictEqual(result.split('\n')[0], '## Known Lint Issues');
    });
});

suite('StackFrame helper', () => {
    test('should build app frame with source ref', () => {
        const f = frame('lib/main.dart', 10);
        assert.strictEqual(f.isApp, true);
        assert.strictEqual(f.sourceRef?.filePath, 'lib/main.dart');
        assert.strictEqual(f.sourceRef?.line, 10);
    });

    test('should build framework frame', () => {
        const f = frame('package:flutter/widgets.dart', 99, false);
        assert.strictEqual(f.isApp, false);
    });
});
