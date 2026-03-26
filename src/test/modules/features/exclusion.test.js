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
const exclusion_matcher_1 = require("../../../modules/features/exclusion-matcher");
suite('ExclusionMatcher', () => {
    suite('parseExclusionPattern', () => {
        test('should parse a plain string pattern', () => {
            const rule = (0, exclusion_matcher_1.parseExclusionPattern)('debug');
            assert.ok(rule);
            assert.strictEqual(rule.text, 'debug');
            assert.strictEqual(rule.source, 'debug');
            assert.strictEqual(rule.regex, undefined);
        });
        test('should parse a regex pattern', () => {
            const rule = (0, exclusion_matcher_1.parseExclusionPattern)('/error\\d+/i');
            assert.ok(rule);
            assert.ok(rule.regex);
            assert.strictEqual(rule.regex.source, 'error\\d+');
            assert.strictEqual(rule.regex.flags, 'i');
        });
        test('should return undefined for empty string', () => {
            assert.strictEqual((0, exclusion_matcher_1.parseExclusionPattern)(''), undefined);
            assert.strictEqual((0, exclusion_matcher_1.parseExclusionPattern)('   '), undefined);
        });
        test('should return undefined for invalid regex', () => {
            assert.strictEqual((0, exclusion_matcher_1.parseExclusionPattern)('/[invalid/'), undefined);
        });
        test('should treat single slash as plain text', () => {
            const rule = (0, exclusion_matcher_1.parseExclusionPattern)('/');
            assert.ok(rule);
            assert.strictEqual(rule.text, '/');
        });
        test('should trim whitespace from pattern', () => {
            const rule = (0, exclusion_matcher_1.parseExclusionPattern)('  warn  ');
            assert.ok(rule);
            assert.strictEqual(rule.text, 'warn');
        });
    });
    suite('testExclusion', () => {
        test('should match case-insensitively for string patterns', () => {
            const rules = [{ source: 'error', text: 'error' }];
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('An ERROR occurred', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('An Error occurred', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('All good', rules), false);
        });
        test('should match regex patterns', () => {
            const rules = [{ source: '/warn\\d+/', regex: /warn\d+/ }];
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('warn123 detected', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('warning text', rules), false);
        });
        test('should return false for empty rules', () => {
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('anything', []), false);
        });
        test('should match if any rule matches', () => {
            const rules = [
                { source: 'error', text: 'error' },
                { source: 'debug', text: 'debug' },
            ];
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('debug info', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('error info', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('warning info', rules), false);
        });
        test('should handle special characters in plain text', () => {
            const rules = [{ source: '[foo]', text: '[foo]' }];
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('value is [foo] bar', rules), true);
            assert.strictEqual((0, exclusion_matcher_1.testExclusion)('value is foo bar', rules), false);
        });
    });
});
//# sourceMappingURL=exclusion.test.js.map