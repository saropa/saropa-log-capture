import * as assert from 'assert';
import * as vscode from 'vscode';
import { formatBugReport } from '../modules/bug-report-formatter';
import type { BugReportData } from '../modules/bug-report-collector';

function minimalData(overrides?: Partial<BugReportData>): BugReportData {
    return {
        errorLine: 'NullPointerException: null',
        fingerprint: 'abc12345',
        stackTrace: [],
        logContext: [],
        environment: {},
        devEnvironment: {},
        gitHistory: [],
        lineRangeHistory: [],
        fileAnalyses: [],
        logFilename: 'session.log',
        lineNumber: 42,
        ...overrides,
    };
}

suite('BugReportFormatter', () => {

    suite('formatBugReport — structure', () => {

        test('should include Bug Report header', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('# Bug Report'));
        });

        test('should include error section with fingerprint', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('## Error'));
            assert.ok(md.includes('abc12345'));
        });

        test('should include error line in code block', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('NullPointerException: null'));
        });

        test('should include Sources section with log filename', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('## Sources'));
            assert.ok(md.includes('session.log'));
        });

        test('should include footer with line number', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('line 42'));
        });

        test('should include Saropa Lints promotion', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('Saropa Lints'));
        });
    });

    suite('formatBugReport — stack trace', () => {

        test('should show no stack trace message when empty', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('No stack trace detected'));
        });

        test('should format app frames with >>> prefix', () => {
            const md = formatBugReport(minimalData({
                stackTrace: [{ text: 'handler.dart:42', isApp: true }],
            }));
            assert.ok(md.includes('>>> handler.dart:42'));
        });

        test('should format framework frames with indent', () => {
            const md = formatBugReport(minimalData({
                stackTrace: [{ text: 'package:flutter/src/widgets.dart:100', isApp: false }],
            }));
            assert.ok(md.includes('    package:flutter'));
        });

        test('should show frame count summary', () => {
            const md = formatBugReport(minimalData({
                stackTrace: [
                    { text: 'app.dart:1', isApp: true },
                    { text: 'fw.dart:2', isApp: false },
                ],
            }));
            assert.ok(md.includes('2 frames (1 app, 1 framework)'));
        });
    });

    suite('formatBugReport — log context', () => {

        test('should show no context message when empty', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('No preceding log lines'));
        });

        test('should include context lines', () => {
            const md = formatBugReport(minimalData({
                logContext: ['Starting app...', 'Connecting to API...'],
            }));
            assert.ok(md.includes('2 lines before error'));
            assert.ok(md.includes('Starting app...'));
        });
    });

    suite('formatBugReport — environment', () => {

        test('should format environment as table', () => {
            const md = formatBugReport(minimalData({
                environment: { 'Dart SDK': '3.2.1', 'Flutter': '3.16.0' },
            }));
            assert.ok(md.includes('## Environment'));
            assert.ok(md.includes('Dart SDK'));
            assert.ok(md.includes('3.2.1'));
        });

        test('should show empty message when no environment', () => {
            const md = formatBugReport(minimalData());
            assert.ok(md.includes('No environment data available'));
        });
    });

    suite('formatBugReport — optional sections', () => {

        test('should include blame section when present', () => {
            const md = formatBugReport(minimalData({
                blame: { hash: 'abc1234', author: 'alice', date: '2024-01-15', message: 'fix timeout' },
            }));
            assert.ok(md.includes('## Git Blame'));
            assert.ok(md.includes('alice'));
            assert.ok(md.includes('fix timeout'));
        });

        test('should include git history when present', () => {
            const md = formatBugReport(minimalData({
                gitHistory: [{ hash: 'abc1234', date: '2024-01-15', message: 'initial commit' }],
            }));
            assert.ok(md.includes('## Recent Git History'));
            assert.ok(md.includes('abc1234'));
        });

        test('should include cross-session data when present', () => {
            const md = formatBugReport(minimalData({
                crossSessionMatch: {
                    sessionCount: 3,
                    totalOccurrences: 10,
                    firstSeen: '2024-01-10',
                    lastSeen: '2024-01-15',
                },
            }));
            assert.ok(md.includes('## Cross-Session History'));
            assert.ok(md.includes('3 sessions'));
            assert.ok(md.includes('10 occurrences'));
        });

        test('should include affected files when present', () => {
            const md = formatBugReport(minimalData({
                fileAnalyses: [{
                    filePath: '/src/handler.dart',
                    uri: vscode.Uri.file('/src/handler.dart'),
                    recentCommits: [],
                    frameLines: [42, 58],
                }],
            }));
            assert.ok(md.includes('## Affected Files'));
            assert.ok(md.includes('handler.dart'));
            assert.ok(md.includes('L42, L58'));
        });

        test('should include primary source path in Sources', () => {
            const md = formatBugReport(minimalData({
                primarySourcePath: '/src/handler.dart',
            }));
            assert.ok(md.includes('handler.dart'));
        });

        test('should include repository URL when available', () => {
            const md = formatBugReport(minimalData({
                devEnvironment: { 'Git Remote': 'https://github.com/test/repo' },
            }));
            assert.ok(md.includes('https://github.com/test/repo'));
        });
    });

    suite('formatBugReport — singular/plural', () => {

        test('should use singular for 1 session', () => {
            const md = formatBugReport(minimalData({
                crossSessionMatch: {
                    sessionCount: 1, totalOccurrences: 1,
                    firstSeen: '2024-01-10', lastSeen: '2024-01-10',
                },
            }));
            assert.ok(md.includes('1 session'));
            assert.ok(md.includes('1 occurrence'));
        });
    });
});
