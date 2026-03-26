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
const code_quality_metrics_1 = require("../../../modules/integrations/providers/code-quality-metrics");
suite('CodeQualityMetrics', () => {
    // --- extractReferencedFiles ---
    test('should extract file paths from Node stack frames', () => {
        const log = [
            'Error: something broke',
            '    at doStuff (src/utils/helper.ts:42:10)',
            '    at main (src/index.ts:15:3)',
            'Some other log line',
        ].join('\n');
        const files = (0, code_quality_metrics_1.extractReferencedFiles)(log, '/workspace');
        assert.ok(files.includes('src/utils/helper.ts'));
        assert.ok(files.includes('src/index.ts'));
    });
    test('should extract file paths from Dart stack frames', () => {
        const log = [
            '#0  main (package:app/main.dart:15)',
            '#1  runApp (package:flutter/widgets.dart:20)',
        ].join('\n');
        const files = (0, code_quality_metrics_1.extractReferencedFiles)(log, '/workspace');
        assert.ok(files.length > 0);
    });
    test('should skip non-stack-frame lines', () => {
        const log = [
            'INFO: Starting application',
            'DEBUG: Config loaded',
            'Done.',
        ].join('\n');
        const files = (0, code_quality_metrics_1.extractReferencedFiles)(log, '/workspace');
        assert.strictEqual(files.length, 0);
    });
    test('should deduplicate file paths', () => {
        const log = [
            '    at foo (src/app.ts:10:5)',
            '    at bar (src/app.ts:20:3)',
        ].join('\n');
        const files = (0, code_quality_metrics_1.extractReferencedFiles)(log, '/workspace');
        const unique = new Set(files);
        assert.strictEqual(files.length, unique.size);
    });
    test('should return empty array for empty log', () => {
        const files = (0, code_quality_metrics_1.extractReferencedFiles)('', '/workspace');
        assert.strictEqual(files.length, 0);
    });
    // --- buildSummary ---
    test('should compute average line coverage', () => {
        const files = {
            'src/a.ts': { linePercent: 80 },
            'src/b.ts': { linePercent: 40 },
        };
        const summary = (0, code_quality_metrics_1.buildSummary)(files);
        assert.strictEqual(summary.avgLineCoverage, 60);
        assert.strictEqual(summary.filesAnalyzed, 2);
    });
    test('should aggregate lint totals', () => {
        const files = {
            'src/a.ts': { lintWarnings: 3, lintErrors: 1 },
            'src/b.ts': { lintWarnings: 2, lintErrors: 0 },
        };
        const summary = (0, code_quality_metrics_1.buildSummary)(files);
        assert.strictEqual(summary.totalLintWarnings, 5);
        assert.strictEqual(summary.totalLintErrors, 1);
    });
    test('should return undefined avgLineCoverage when no coverage data', () => {
        const files = {
            'src/a.ts': { lintWarnings: 1 },
        };
        const summary = (0, code_quality_metrics_1.buildSummary)(files);
        assert.strictEqual(summary.avgLineCoverage, undefined);
    });
    test('should sort lowestCoverageFiles ascending', () => {
        const files = {
            'src/high.ts': { linePercent: 90 },
            'src/low.ts': { linePercent: 10 },
            'src/mid.ts': { linePercent: 50 },
        };
        const summary = (0, code_quality_metrics_1.buildSummary)(files);
        assert.strictEqual(summary.lowestCoverageFiles[0].path, 'src/low.ts');
        assert.strictEqual(summary.lowestCoverageFiles[0].linePercent, 10);
    });
    test('should cap lowestCoverageFiles at 5', () => {
        const files = {};
        for (let i = 0; i < 10; i++) {
            files[`src/file${i}.ts`] = { linePercent: i * 10 };
        }
        const summary = (0, code_quality_metrics_1.buildSummary)(files);
        assert.strictEqual(summary.lowestCoverageFiles.length, 5);
    });
    test('should handle empty files record', () => {
        const summary = (0, code_quality_metrics_1.buildSummary)({});
        assert.strictEqual(summary.filesAnalyzed, 0);
        assert.strictEqual(summary.avgLineCoverage, undefined);
        assert.strictEqual(summary.totalLintWarnings, 0);
        assert.strictEqual(summary.totalLintErrors, 0);
        assert.strictEqual(summary.lowestCoverageFiles.length, 0);
    });
});
//# sourceMappingURL=code-quality-metrics.test.js.map