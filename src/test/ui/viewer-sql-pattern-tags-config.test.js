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
suite('SQL pattern tags script (DB_05 config injection)', () => {
    test('getSqlPatternTagsScript injects clamped min count and max chips', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)(5, 12);
        assert.ok(s.includes('var sqlChipMinCount = 5'));
        assert.ok(s.includes('var sqlPatternMaxChips = 12'));
    });
    test('getSqlPatternTagsScript clamps out-of-range values', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)(0, 500);
        assert.ok(s.includes('var sqlChipMinCount = 1'));
        assert.ok(s.includes('var sqlPatternMaxChips = 100'));
    });
    test('getSqlPatternTagsScript uses defaults when args are non-finite (false positive guard)', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)(Number.NaN, Number.NaN);
        assert.ok(s.includes('var sqlChipMinCount = 2'));
        assert.ok(s.includes('var sqlPatternMaxChips = 20'));
    });
    test('embedded script defines applyViewerSqlPatternChipSettings for host messages', () => {
        const s = (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)();
        assert.ok(s.includes('function applyViewerSqlPatternChipSettings'));
    });
});
//# sourceMappingURL=viewer-sql-pattern-tags-config.test.js.map