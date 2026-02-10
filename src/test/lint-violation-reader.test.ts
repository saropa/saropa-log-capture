import * as assert from 'assert';
import type { StackFrame } from '../modules/bug-report-collector';
import type { LintReportData } from '../modules/lint-violation-reader';
import { formatLintSection } from '../modules/bug-report-lint-section';

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
            timestamp: new Date().toISOString(), isStale: false,
        };
        const result = formatLintSection(data);
        assert.ok(result.includes('saropa_lints,'));
        assert.ok(!result.includes('saropa_lints v'));
    });

    test('should show staleness warning when stale', () => {
        const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const result = formatLintSection(buildData({ timestamp: old, isStale: true }));
        assert.ok(result.includes('may be stale'));
        assert.ok(result.includes('dart run custom_lint'));
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
