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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const session_summary_1 = require("../../../modules/session/session-summary");
suite('SessionSummary', () => {
    suite('formatDuration', () => {
        test('should format milliseconds', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(500), '500ms');
        });
        test('should format seconds', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(5000), '5s');
        });
        test('should format minutes and seconds', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(90000), '1m 30s');
        });
        test('should format minutes only when no seconds', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(120000), '2m');
        });
        test('should format hours and minutes', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(5400000), '1h 30m');
        });
        test('should format hours only when no minutes', () => {
            assert.strictEqual((0, session_summary_1.formatDuration)(3600000), '1h');
        });
    });
    suite('formatBytes', () => {
        test('should format bytes', () => {
            assert.strictEqual((0, session_summary_1.formatBytes)(500), '500 B');
        });
        test('should format kilobytes', () => {
            const result = (0, session_summary_1.formatBytes)(2048);
            assert.ok(result.includes('KB'));
        });
        test('should format megabytes', () => {
            const result = (0, session_summary_1.formatBytes)(2 * 1024 * 1024);
            assert.ok(result.includes('MB'));
        });
    });
    suite('generateSummary', () => {
        test('should generate summary with basic stats', () => {
            const stats = {
                ...(0, session_summary_1.defaultSessionStats)(),
                lineCount: 1234,
                bytesWritten: 50000,
                durationMs: 60000,
            };
            const summary = (0, session_summary_1.generateSummary)('test.log', stats);
            assert.strictEqual(summary.title, 'Log Captured: test.log');
            assert.ok(summary.lines.some(l => l.includes('1,234')));
            assert.ok(summary.lines.some(l => l.includes('Duration')));
        });
        test('should include split count when multiple parts', () => {
            const stats = {
                ...(0, session_summary_1.defaultSessionStats)(),
                partCount: 3,
            };
            const summary = (0, session_summary_1.generateSummary)('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('3 parts')));
        });
        test('should include category breakdown', () => {
            const stats = {
                ...(0, session_summary_1.defaultSessionStats)(),
                categoryCounts: { stdout: 100, stderr: 5 },
            };
            const summary = (0, session_summary_1.generateSummary)('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('stdout')));
        });
        test('should include watch hits', () => {
            const stats = {
                ...(0, session_summary_1.defaultSessionStats)(),
                watchHitCounts: { error: 10 },
            };
            const summary = (0, session_summary_1.generateSummary)('test.log', stats);
            assert.ok(summary.lines.some(l => l.includes('error')));
        });
    });
    suite('defaultSessionStats', () => {
        test('should return all zero values', () => {
            const stats = (0, session_summary_1.defaultSessionStats)();
            assert.strictEqual(stats.lineCount, 0);
            assert.strictEqual(stats.bytesWritten, 0);
            assert.strictEqual(stats.durationMs, 0);
            assert.strictEqual(stats.partCount, 1);
        });
    });
    suite('withLogUri', () => {
        test('should add logUri to summary without mutating original', () => {
            const stats = (0, session_summary_1.defaultSessionStats)();
            const base = (0, session_summary_1.generateSummary)('app.log', stats);
            assert.strictEqual(base.logUri, undefined);
            const uri = vscode.Uri.file('/logs/app.log');
            const withUri = (0, session_summary_1.withLogUri)(base, uri);
            assert.strictEqual(withUri.logUri?.toString(), uri.toString());
            assert.strictEqual(base.logUri, undefined);
        });
        test('should preserve title and lines', () => {
            const stats = { ...(0, session_summary_1.defaultSessionStats)(), lineCount: 10 };
            const base = (0, session_summary_1.generateSummary)('test.log', stats);
            const withUri = (0, session_summary_1.withLogUri)(base, vscode.Uri.file('/x/test.log'));
            assert.strictEqual(withUri.title, base.title);
            assert.deepStrictEqual(withUri.lines, base.lines);
        });
    });
});
//# sourceMappingURL=session-summary.test.js.map