"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const lint_violation_reader_1 = require("../../../modules/misc/lint-violation-reader");
const bug_report_lint_section_1 = require("../../../modules/bug-report/bug-report-lint-section");
/** Helper to build a minimal stack frame. */
function frame(filePath, line, isApp = true) {
    return { text: `at ${filePath}:${line}`, isApp, sourceRef: { filePath, line } };
}
function buildData(overrides = {}) {
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
suite('formatLintSection', () => {
    test('should format single violation', () => {
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData());
        assert.ok(result.includes('## Known Lint Issues'));
        assert.ok(result.includes('1 lint violation found'));
        assert.ok(result.includes('require_field_dispose'));
        assert.ok(result.includes('critical'));
        assert.ok(result.includes('lib/auth.dart'));
        assert.ok(result.includes('saropa-lints:explainRule'));
        assert.ok(result.includes('Explain'));
    });
    test('should pluralize for multiple violations', () => {
        const data = buildData({
            matches: [
                { file: 'lib/a.dart', line: 1, rule: 'r1', message: 'msg1', severity: 'error', impact: 'critical', owasp: { mobile: [], web: [] } },
                { file: 'lib/b.dart', line: 2, rule: 'r2', message: 'msg2', severity: 'warning', impact: 'high', owasp: { mobile: [], web: [] } },
            ],
        });
        const result = (0, bug_report_lint_section_1.formatLintSection)(data);
        assert.ok(result.includes('2 lint violations found'));
    });
    test('should include source line with version and tier', () => {
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData({ version: '4.14.0', tier: 'professional' }));
        assert.ok(result.includes('saropa_lints v4.14.0'));
        assert.ok(result.includes('professional tier'));
    });
    test('should omit version when absent', () => {
        const data = {
            matches: [{ file: 'lib/a.dart', line: 1, rule: 'r1', message: 'msg', severity: 'info', impact: 'low', owasp: { mobile: [], web: [] } }],
            totalInExport: 1, tier: 'comprehensive', version: undefined,
            timestamp: new Date().toISOString(), isStale: false, hasExtension: false,
            filesAnalyzed: 50, byImpact: {},
        };
        const result = (0, bug_report_lint_section_1.formatLintSection)(data);
        assert.ok(result.includes('saropa_lints,'));
        assert.ok(!result.includes('saropa_lints v'));
    });
    test('should show CLI staleness warning when no extension', () => {
        const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData({ timestamp: old, isStale: true, hasExtension: false }));
        assert.ok(result.includes('may be stale'));
        assert.ok(result.includes('dart run custom_lint'));
        assert.ok(!result.includes('Saropa Lints'));
    });
    test('should show extension staleness warning when extension detected', () => {
        const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData({ timestamp: old, isStale: true, hasExtension: true }));
        assert.ok(result.includes('may be stale'));
        assert.ok(result.includes('Run analysis in Saropa Lints'));
        assert.ok(!result.includes('dart run custom_lint'));
    });
    test('should include impact breakdown when byImpact has non-zero counts', () => {
        const data = buildData({ byImpact: { critical: 2, high: 5, medium: 0, low: 3 } });
        const result = (0, bug_report_lint_section_1.formatLintSection)(data);
        assert.ok(result.includes('2 critical, 5 high, 3 low'));
        // Breakdown should appear before the violations count line.
        const breakdownIdx = result.indexOf('2 critical');
        const countIdx = result.indexOf('1 lint violation');
        assert.ok(breakdownIdx < countIdx, 'breakdown should appear before violation count');
    });
    test('should omit breakdown when byImpact is empty', () => {
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData({ byImpact: {} }));
        // The breakdown line would appear between the heading and the count line.
        // With empty byImpact, the count line should immediately follow the heading.
        const sections = result.split('\n\n');
        assert.strictEqual(sections[0], '## Known Lint Issues');
        assert.ok(sections[1].startsWith('1 lint violation'));
    });
    test('should not show staleness warning when fresh', () => {
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData({ isStale: false }));
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
        const result = (0, bug_report_lint_section_1.formatLintSection)(data);
        assert.ok(result.includes(String.raw `value \| must be checked`));
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
        const result = (0, bug_report_lint_section_1.formatLintSection)(data);
        const tableRow = result.split('\n').find(l => l.includes('r1'));
        // Row includes an extra "Explain" column; keep it bounded to ensure the
        // full long message is not embedded into the link href.
        assert.ok(tableRow && tableRow.length < longMsg.length + 250);
    });
    test('should filter by impact level essential (critical + high only)', () => {
        const data = buildData({
            matches: [
                { file: 'lib/a.dart', line: 1, rule: 'r1', message: 'm1', severity: 'error', impact: 'critical', owasp: { mobile: [], web: [] } },
                { file: 'lib/b.dart', line: 2, rule: 'r2', message: 'm2', severity: 'warning', impact: 'high', owasp: { mobile: [], web: [] } },
                { file: 'lib/c.dart', line: 3, rule: 'r3', message: 'm3', severity: 'info', impact: 'medium', owasp: { mobile: [], web: [] } },
            ],
        });
        const result = (0, bug_report_lint_section_1.formatLintSection)(data, 'essential');
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
        const result = (0, bug_report_lint_section_1.formatLintSection)(data, 'recommended');
        assert.ok(result.includes('## Known Lint Issues (up to medium)'));
        assert.ok(result.includes('1 lint violation found'));
        assert.ok(result.includes('r2'));
        assert.ok(!result.includes('r1'));
    });
    test('should show no suffix for impact level full', () => {
        const result = (0, bug_report_lint_section_1.formatLintSection)(buildData(), 'full');
        assert.strictEqual(result.split('\n')[0], '## Known Lint Issues');
    });
});
suite('lint export staleness and stack paths', () => {
    test('isLintExportTimestampStale is true for empty or invalid timestamp', () => {
        assert.strictEqual((0, lint_violation_reader_1.isLintExportTimestampStale)(''), true);
        assert.strictEqual((0, lint_violation_reader_1.isLintExportTimestampStale)('not-a-date'), true);
    });
    test('isLintExportTimestampStale is false for recent ISO timestamp', () => {
        const recent = new Date().toISOString();
        assert.strictEqual((0, lint_violation_reader_1.isLintExportTimestampStale)(recent), false);
    });
    test('isLintExportTimestampStale is true when older than threshold', () => {
        const old = new Date(Date.now() - lint_violation_reader_1.LINT_EXPORT_STALE_THRESHOLD_MS - 60_000).toISOString();
        assert.strictEqual((0, lint_violation_reader_1.isLintExportTimestampStale)(old), true);
    });
    test('collectAppStackRelativePaths dedupes and caps', () => {
        const frames = [
            { text: '', isApp: true, sourceRef: { filePath: 'lib/a.dart', line: 1 } },
            { text: '', isApp: true, sourceRef: { filePath: 'lib/a.dart', line: 2 } },
            { text: '', isApp: false, sourceRef: { filePath: 'lib/b.dart', line: 1 } },
        ];
        const paths = (0, lint_violation_reader_1.collectAppStackRelativePaths)(frames, 10);
        assert.strictEqual(paths.length, 1);
        assert.strictEqual(paths[0], 'lib/a.dart');
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
//# sourceMappingURL=lint-violation-reader.test.js.map