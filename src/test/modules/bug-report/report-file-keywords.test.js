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
const report_file_keywords_1 = require("../../../modules/bug-report/report-file-keywords");
suite('ReportFileKeywords', () => {
    suite('extractKeywords', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual((0, report_file_keywords_1.extractKeywords)(''), []);
        });
        test('should extract severity words', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('There was a fatal error in the system');
            assert.ok(result.includes('error'));
            assert.ok(result.includes('fatal'));
        });
        test('should extract crash-related severity', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('Application crash with null pointer');
            assert.ok(result.includes('crash'));
            assert.ok(result.includes('null'));
        });
        test('should extract repeated words', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('connection timeout and another connection timeout again');
            assert.ok(result.includes('timeout'));
            assert.ok(result.includes('connection'));
        });
        test('should not extract stop words', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('the the the and and and');
            assert.deepStrictEqual(result, []);
        });
        test('should extract camelCase identifiers', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('NullPointerException was thrown');
            assert.ok(result.some(k => k.includes('nullpointer')));
        });
        test('should extract file name identifiers', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('Error in session-manager.ts at line 42');
            assert.ok(result.some(k => k.includes('session-manager')));
        });
        test('should respect max parameter', () => {
            const text = 'error fatal crash timeout null overflow denied failed failure panic';
            const result = (0, report_file_keywords_1.extractKeywords)(text, 2);
            assert.ok(result.length <= 2);
        });
        test('should default to max 3 keywords', () => {
            const text = 'error fatal crash timeout null overflow denied';
            const result = (0, report_file_keywords_1.extractKeywords)(text);
            assert.ok(result.length <= 3);
        });
        test('should deduplicate keywords', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('error error error error');
            const unique = new Set(result);
            assert.strictEqual(result.length, unique.size);
        });
        test('should sanitize keywords for filenames', () => {
            const result = (0, report_file_keywords_1.extractKeywords)('crash! in @special chars');
            for (const kw of result) {
                assert.ok(/^[a-z0-9-]+$/.test(kw), `"${kw}" should be filename-safe`);
            }
        });
        test('should truncate long keywords to 20 chars', () => {
            // Feed a very long camelCase identifier
            const longId = 'VeryLongClassNameThatExceedsTwentyCharacters';
            const result = (0, report_file_keywords_1.extractKeywords)(longId);
            for (const kw of result) {
                assert.ok(kw.length <= 20, `"${kw}" should be ≤20 chars`);
            }
        });
        test('should handle mixed severity and identifiers', () => {
            const text = 'NullPointerException: crash at UserService.login';
            const result = (0, report_file_keywords_1.extractKeywords)(text, 5);
            assert.ok(result.length > 0);
            assert.ok(result.includes('crash') || result.includes('null'));
        });
    });
});
//# sourceMappingURL=report-file-keywords.test.js.map