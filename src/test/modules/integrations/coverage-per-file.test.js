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
const coverage_per_file_1 = require("../../../modules/integrations/providers/coverage-per-file");
suite('CoveragePerFile', () => {
    // --- LCOV ---
    test('should parse lcov with multiple files', () => {
        const lcov = [
            'SF:/home/user/project/src/foo.ts',
            'DA:1,1', 'DA:2,0', 'LF:10', 'LH:8',
            'end_of_record',
            'SF:/home/user/project/src/bar.ts',
            'DA:1,1', 'LF:20', 'LH:4',
            'end_of_record',
        ].join('\n');
        const map = (0, coverage_per_file_1.parseLcovPerFile)(lcov);
        assert.strictEqual(map.size, 2);
        assert.strictEqual(map.get('home/user/project/src/foo.ts'), 80);
        assert.strictEqual(map.get('home/user/project/src/bar.ts'), 20);
    });
    test('should skip lcov files with zero lines found', () => {
        const lcov = 'SF:/src/empty.ts\nLF:0\nLH:0\nend_of_record\n';
        const map = (0, coverage_per_file_1.parseLcovPerFile)(lcov);
        assert.strictEqual(map.size, 0);
    });
    test('should handle lcov with Windows paths', () => {
        const lcov = 'SF:C:\\Users\\dev\\src\\app.ts\nLF:50\nLH:25\nend_of_record\n';
        const map = (0, coverage_per_file_1.parseLcovPerFile)(lcov);
        assert.strictEqual(map.size, 1);
        assert.strictEqual(map.get('users/dev/src/app.ts'), 50);
    });
    // --- Cobertura ---
    test('should parse cobertura with multiple classes', () => {
        const xml = `<coverage>
            <packages><package>
                <classes>
                    <class filename="src/foo.ts" line-rate="0.85" branch-rate="0.5"/>
                    <class filename="src/bar.ts" line-rate="0.40" branch-rate="0.0"/>
                </classes>
            </package></packages>
        </coverage>`;
        const map = (0, coverage_per_file_1.parseCoberturaPerFile)(xml);
        assert.strictEqual(map.size, 2);
        assert.strictEqual(map.get('src/foo.ts'), 85);
        assert.strictEqual(map.get('src/bar.ts'), 40);
    });
    // --- Istanbul JSON ---
    test('should parse Istanbul summary JSON per file', () => {
        const json = JSON.stringify({
            total: { lines: { pct: 72 } },
            'src/foo.ts': { lines: { pct: 90 }, branches: { pct: 60 } },
            'src/bar.ts': { lines: { pct: 30 }, branches: { pct: 10 } },
        });
        const map = (0, coverage_per_file_1.parseSummaryJsonPerFile)(json);
        assert.strictEqual(map.size, 2);
        assert.strictEqual(map.get('src/foo.ts'), 90);
        assert.strictEqual(map.get('src/bar.ts'), 30);
    });
    test('should skip total key in Istanbul JSON', () => {
        const json = JSON.stringify({ total: { lines: { pct: 50 } } });
        const map = (0, coverage_per_file_1.parseSummaryJsonPerFile)(json);
        assert.strictEqual(map.size, 0);
    });
    // --- lookupCoverage ---
    test('should find exact normalized match', () => {
        const map = new Map([['src/foo.ts', 85]]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/foo.ts'), 85);
    });
    test('should find match with suffix', () => {
        const map = new Map([['home/user/project/src/foo.ts', 85]]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/foo.ts'), 85);
    });
    test('should fall back to basename match', () => {
        const map = new Map([['some/deep/path/foo.ts', 42]]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'completely/different/foo.ts'), 42);
    });
    test('should return undefined when no match', () => {
        const map = new Map([['src/foo.ts', 85]]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/baz.ts'), undefined);
    });
    test('should handle empty map', () => {
        const map = new Map();
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'anything.ts'), undefined);
    });
    test('should return undefined for ambiguous basename match', () => {
        const map = new Map([['src/a/index.ts', 80], ['src/b/index.ts', 40]]);
        // Both share basename 'index.ts' — ambiguous, should return undefined.
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'other/index.ts'), undefined);
    });
    // --- Cobertura attribute order ---
    test('should parse cobertura with reversed attribute order', () => {
        const xml = '<class line-rate="0.72" filename="src/reversed.ts"/>';
        const map = (0, coverage_per_file_1.parseCoberturaPerFile)(xml);
        assert.strictEqual(map.get('src/reversed.ts'), 72);
    });
    // --- Istanbul JSON error handling ---
    test('should return empty map for invalid JSON', () => {
        const map = (0, coverage_per_file_1.parseSummaryJsonPerFile)('not json at all');
        assert.strictEqual(map.size, 0);
    });
    // --- Lcov duplicate SF entries ---
    test('should handle duplicate SF entries (merged coverage)', () => {
        const lcov = [
            'SF:/src/foo.ts', 'LF:10', 'LH:8', 'end_of_record',
            'SF:/src/foo.ts', 'LF:10', 'LH:10', 'end_of_record',
        ].join('\n');
        const map = (0, coverage_per_file_1.parseLcovPerFile)(lcov);
        // Last entry wins for duplicate paths.
        assert.strictEqual(map.get('src/foo.ts'), 100);
    });
    // --- Badge threshold boundaries ---
    test('should lookup coverage at boundary values', () => {
        const map = new Map([
            ['src/a.ts', 80], ['src/b.ts', 50], ['src/c.ts', 49],
            ['src/d.ts', 0], ['src/e.ts', 100],
        ]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/a.ts'), 80);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/b.ts'), 50);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/c.ts'), 49);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/d.ts'), 0);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src/e.ts'), 100);
    });
    // --- Windows backslash paths in lookup ---
    test('should handle Windows backslash paths in lookup', () => {
        const map = new Map([['src/foo.ts', 75]]);
        assert.strictEqual((0, coverage_per_file_1.lookupCoverage)(map, 'src\\foo.ts'), 75);
    });
});
//# sourceMappingURL=coverage-per-file.test.js.map