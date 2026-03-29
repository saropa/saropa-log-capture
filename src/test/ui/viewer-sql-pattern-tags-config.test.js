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
const viewer_sql_pattern_tags_1 = require("../../ui/viewer-stack-tags/viewer-sql-pattern-tags");
suite('SQL verb-based command chips (plan 043)', () => {
    test('should take no parameters', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(typeof s === 'string' && s.length > 0);
    });
    test('should define verb tracking variables', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(s.includes('var sqlVerbCounts'));
        assert.ok(s.includes('var hiddenSqlVerbs'));
        assert.ok(s.includes('var sqlVerbOrder'));
    });
    test('should define sqlVerbCategory mapping function', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(s.includes('function sqlVerbCategory'));
    });
    test('should not contain removed fingerprint-based settings', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(!s.includes('applyViewerSqlPatternChipSettings'));
        assert.ok(!s.includes('sqlChipMinCount'));
        assert.ok(!s.includes('sqlPatternMaxChips'));
        assert.ok(!s.includes('sqlPatternRawCounts'));
        assert.ok(!s.includes('promoteSqlFingerprintChip'));
        assert.ok(!s.includes('demoteSqlFingerprintChip'));
    });
    test('should include all six verb categories in order', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(s.includes("'SELECT'"));
        assert.ok(s.includes("'INSERT'"));
        assert.ok(s.includes("'UPDATE'"));
        assert.ok(s.includes("'DELETE'"));
        assert.ok(s.includes("'Transaction'"));
        assert.ok(s.includes("'Other SQL'"));
    });
});
//# sourceMappingURL=viewer-sql-pattern-tags-config.test.js.map