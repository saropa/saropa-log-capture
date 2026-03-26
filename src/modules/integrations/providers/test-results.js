"use strict";
/**
 * Test results integration: reads last-test-run.json or JUnit XML at session
 * start and adds summary + failed tests to header and meta.
 */
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
exports.testResultsProvider = void 0;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
const safe_json_1 = require("../../misc/safe-json");
const MAX_TEST_RESULTS_FILE_BYTES = 1024 * 1024; // 1 MB
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('testResults');
}
function fromFile(workspaceFolder, relativePath, maxAgeMs) {
    try {
        if (!workspaceFolder?.uri) {
            return undefined;
        }
        const abs = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, relativePath).fsPath;
        const stat = fs.statSync(abs);
        if (!stat.isFile() || stat.size > MAX_TEST_RESULTS_FILE_BYTES || Date.now() - stat.mtimeMs > maxAgeMs) {
            return undefined;
        }
        const raw = fs.readFileSync(abs, 'utf-8');
        const data = (0, safe_json_1.safeParseJSON)(raw);
        if (!data || typeof data !== 'object') {
            return undefined;
        }
        const total = Number(data.total) || 0;
        const passed = Number(data.passed) || 0;
        const failed = Number(data.failed) || 0;
        const skipped = Number(data.skipped) || 0;
        const failedTests = Array.isArray(data.failedTests)
            ? data.failedTests
                .filter(t => t && typeof t.name === 'string')
                .map(t => ({ name: t.name, file: t.file, line: t.line }))
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
    }
    catch {
        return undefined;
    }
}
function parseJUnit(workspaceFolder, relativePath) {
    try {
        const abs = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, relativePath).fsPath;
        const xml = fs.readFileSync(abs, 'utf-8');
        const testsuiteMatch = xml.match(/<testsuite[^>]*\s(?:tests|testcase)=/);
        if (!testsuiteMatch) {
            return undefined;
        }
        const total = parseInt(xml.match(/tests="(\d+)"/)?.[1] ?? '0', 10)
            || (xml.match(/<testcase/g)?.length ?? 0);
        const failures = parseInt(xml.match(/failures="(\d+)"/)?.[1] ?? '0', 10);
        const errors = parseInt(xml.match(/errors="(\d+)"/)?.[1] ?? '0', 10);
        const skipped = parseInt(xml.match(/skipped="(\d+)"/)?.[1] ?? '0', 10);
        const failed = failures + errors;
        const passed = Math.max(0, total - failed - skipped);
        const failedTests = [];
        const caseRegex = /<testcase[^>]*name="([^"]*)"[^>]*(?:file="([^"]*)")?[^>]*(?:line="([^"]*)")?/g;
        const failRegex = /<testcase[^>]*name="([^"]*)"[^>]*>[\s\S]*?<(?:failure|error)/g;
        let m;
        const failedNames = new Set();
        while ((m = failRegex.exec(xml)) !== null) {
            failedNames.add(m[1]);
        }
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
    }
    catch {
        return undefined;
    }
}
exports.testResultsProvider = {
    id: 'testResults',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { workspaceFolder, config } = context;
        const { source, lastRunPath, junitPath, fileMaxAgeHours, includeFailedListInHeader } = config.integrationsTestResults;
        const maxAgeMs = fileMaxAgeHours * 60 * 60 * 1000;
        let summary;
        if (source === 'junit' && junitPath) {
            summary = parseJUnit(workspaceFolder, junitPath);
        }
        else {
            summary = fromFile(workspaceFolder, lastRunPath, maxAgeMs);
        }
        if (!summary || summary.total === 0) {
            return undefined;
        }
        const lines = [
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
//# sourceMappingURL=test-results.js.map