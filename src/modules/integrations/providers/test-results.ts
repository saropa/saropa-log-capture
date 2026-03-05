/**
 * Test results integration: reads last-test-run.json or JUnit XML at session
 * start and adds summary + failed tests to header and meta.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { safeParseJSON } from '../../misc/safe-json';

const MAX_TEST_RESULTS_FILE_BYTES = 1024 * 1024; // 1 MB

export interface TestResultsSummary {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failedTests?: Array<{ name: string; file?: string; line?: number }>;
    sourcePath?: string;
    timestamp?: string;
}

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('testResults');
}

function fromFile(
    workspaceFolder: vscode.WorkspaceFolder,
    relativePath: string,
    maxAgeMs: number,
): TestResultsSummary | undefined {
    try {
        if (!workspaceFolder?.uri) { return undefined; }
        const abs = resolveWorkspaceFileUri(workspaceFolder, relativePath).fsPath;
        const stat = fs.statSync(abs);
        if (!stat.isFile() || stat.size > MAX_TEST_RESULTS_FILE_BYTES || Date.now() - stat.mtimeMs > maxAgeMs) {
            return undefined;
        }
        const raw = fs.readFileSync(abs, 'utf-8');
        const data = safeParseJSON<Record<string, unknown>>(raw);
        if (!data || typeof data !== 'object') { return undefined; }
        const total = Number(data.total) || 0;
        const passed = Number(data.passed) || 0;
        const failed = Number(data.failed) || 0;
        const skipped = Number(data.skipped) || 0;
        const failedTests = Array.isArray(data.failedTests)
            ? (data.failedTests as Array<{ name?: string; file?: string; line?: number }>)
                .filter(t => t && typeof t.name === 'string')
                .map(t => ({ name: t.name!, file: t.file, line: t.line }))
            : undefined;
        return {
            total,
            passed,
            failed,
            skipped,
            failedTests,
            sourcePath: relativePath,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp : undefined,
        };
    } catch {
        return undefined;
    }
}

function parseJUnit(workspaceFolder: vscode.WorkspaceFolder, relativePath: string): TestResultsSummary | undefined {
    try {
        const abs = resolveWorkspaceFileUri(workspaceFolder, relativePath).fsPath;
        const xml = fs.readFileSync(abs, 'utf-8');
        const testsuiteMatch = xml.match(/<testsuite[^>]*\s(?:tests|testcase)=/);
        if (!testsuiteMatch) { return undefined; }
        const total = parseInt(xml.match(/tests="(\d+)"/)?.[1] ?? '0', 10)
            || (xml.match(/<testcase/g)?.length ?? 0);
        const failures = parseInt(xml.match(/failures="(\d+)"/)?.[1] ?? '0', 10);
        const errors = parseInt(xml.match(/errors="(\d+)"/)?.[1] ?? '0', 10);
        const skipped = parseInt(xml.match(/skipped="(\d+)"/)?.[1] ?? '0', 10);
        const failed = failures + errors;
        const passed = Math.max(0, total - failed - skipped);
        const failedTests: Array<{ name: string; file?: string; line?: number }> = [];
        const caseRegex = /<testcase[^>]*name="([^"]*)"[^>]*(?:file="([^"]*)")?[^>]*(?:line="([^"]*)")?/g;
        const failRegex = /<testcase[^>]*name="([^"]*)"[^>]*>[\s\S]*?<(?:failure|error)/g;
        let m: RegExpExecArray | null;
        const failedNames = new Set<string>();
        while ((m = failRegex.exec(xml)) !== null) { failedNames.add(m[1]); }
        while ((m = caseRegex.exec(xml)) !== null) {
            if (failedNames.has(m[1])) {
                failedTests.push({
                    name: m[1],
                    file: m[2] || undefined,
                    line: m[3] ? parseInt(m[3], 10) : undefined,
                });
            }
        }
        return {
            total,
            passed,
            failed,
            skipped,
            failedTests: failedTests.length ? failedTests : undefined,
            sourcePath: relativePath,
        };
    } catch {
        return undefined;
    }
}

export const testResultsProvider: IntegrationProvider = {
    id: 'testResults',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { workspaceFolder, config } = context;
        const { source, lastRunPath, junitPath, fileMaxAgeHours, includeFailedListInHeader } = config.integrationsTestResults;
        const maxAgeMs = fileMaxAgeHours * 60 * 60 * 1000;
        let summary: TestResultsSummary | undefined;
        if (source === 'junit' && junitPath) {
            summary = parseJUnit(workspaceFolder, junitPath);
        } else {
            summary = fromFile(workspaceFolder, lastRunPath, maxAgeMs);
        }
        if (!summary || summary.total === 0) { return undefined; }
        const lines: string[] = [
            `Last test run:  ${summary.passed} passed, ${summary.failed} failed${summary.skipped ? `, ${summary.skipped} skipped` : ''}`,
        ];
        if (includeFailedListInHeader && summary.failedTests && summary.failedTests.length > 0) {
            const names = summary.failedTests.slice(0, 5).map(t => t.name);
            lines.push(`Failed:         ${names.join(', ')}${summary.failedTests.length > 5 ? '…' : ''}`);
        }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'testResults', payload: summary },
        ];
    },
};
