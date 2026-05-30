import * as assert from 'assert';
import {
    classifySessionKind,
    compileReportPatterns,
    defaultReportsKindPatterns,
} from '../../../modules/session/session-kind-classifier';

suite('session-kind-classifier', () => {

    suite('compileReportPatterns', () => {
        test('compiles valid patterns case-insensitive', () => {
            const patterns = compileReportPatterns(['^Saropa Lint Report\\b']);
            assert.strictEqual(patterns.length, 1);
            assert.ok(patterns[0].test('saropa lint report v2'));
            assert.ok(!patterns[0].test('Other thing'));
        });
        test('silently drops invalid regex (never throws)', () => {
            const patterns = compileReportPatterns(['[invalid(', '^Json Bundle\\b']);
            assert.strictEqual(patterns.length, 1);
            assert.ok(patterns[0].test('Json Bundle Audit'));
        });
        test('empty input returns empty array', () => {
            assert.deepStrictEqual(compileReportPatterns([]), []);
        });
    });

    suite('classifySessionKind', () => {
        const patterns = compileReportPatterns(defaultReportsKindPatterns);

        test('explicit kind override wins over all other signals', () => {
            const result = classifySessionKind(
                { kind: 'report', debugAdapterType: 'dart', displayName: 'Contacts' },
                patterns,
                'Contacts',
            );
            assert.strictEqual(result, 'report');
        });

        test('explicit project override wins over a report-looking displayName', () => {
            const result = classifySessionKind(
                { kind: 'project', displayName: 'Saropa Lint Report' },
                patterns,
            );
            assert.strictEqual(result, 'project');
        });

        test('debugAdapterType present → project', () => {
            const result = classifySessionKind(
                { debugAdapterType: 'dart', displayName: 'Saropa Lint Report' },
                patterns,
            );
            assert.strictEqual(result, 'project');
        });

        test('empty debugAdapterType does NOT trigger project rule', () => {
            // Defensive: a corrupted SessionMeta could carry empty string. We must still
            // run the displayName check so a report doesn't escape to project.
            const result = classifySessionKind(
                { debugAdapterType: '', displayName: 'Saropa Lint Report v2' },
                patterns,
            );
            assert.strictEqual(result, 'report');
        });

        test('header Project: matches workspace folder → project', () => {
            const result = classifySessionKind(
                { project: 'Contacts', displayName: 'Saropa Lint Report' },
                patterns,
                'Contacts',
            );
            assert.strictEqual(result, 'project');
        });

        test('case-insensitive workspace folder match', () => {
            const result = classifySessionKind(
                { project: 'CONTACTS', displayName: 'Saropa Lint Report' },
                patterns,
                '  contacts  ',
            );
            assert.strictEqual(result, 'project');
        });

        test('mismatched header Project does NOT block report classification', () => {
            const result = classifySessionKind(
                { project: 'OtherProject', displayName: 'Saropa Lint Report' },
                patterns,
                'Contacts',
            );
            assert.strictEqual(result, 'report');
        });

        test('displayName matching default report pattern → report', () => {
            const cases = [
                'Saropa Lint Report',
                'Json Bundle Audit',
                'Json Bundle Audit Matrix',
                'Json Bundle Translate',
                'Lint Report v3',
                'Audit Matrix',
            ];
            for (const name of cases) {
                const result = classifySessionKind({ displayName: name }, patterns);
                assert.strictEqual(result, 'report', `expected report for "${name}"`);
            }
        });

        test('unknown displayName → project (fail-open default)', () => {
            // The fail-open rule is load-bearing: a misclassified entry must stay visible
            // inline as a project row, never silently buried in the Reports bucket.
            const result = classifySessionKind(
                { displayName: 'My Custom Capture' },
                patterns,
            );
            assert.strictEqual(result, 'project');
        });

        test('missing all signals → project', () => {
            assert.strictEqual(classifySessionKind({}, patterns), 'project');
        });

        test('workspaceFolderName undefined disables the header check', () => {
            // When there's no workspace folder, the header check must not promote anything to project.
            const result = classifySessionKind(
                { project: 'Contacts', displayName: 'Saropa Lint Report' },
                patterns,
                undefined,
            );
            assert.strictEqual(result, 'report');
        });
    });
});
