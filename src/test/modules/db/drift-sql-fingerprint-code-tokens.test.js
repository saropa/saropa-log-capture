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
const assert = __importStar(require("node:assert"));
const drift_sql_fingerprint_code_tokens_1 = require("../../../modules/db/drift-sql-fingerprint-code-tokens");
suite("extractDriftFingerprintSearchTokens", () => {
    test("returns [] for empty", () => {
        assert.deepStrictEqual((0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)(""), []);
    });
    test("skips stopwords, placeholders, and short tokens", () => {
        const t = (0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)("select * from users where id = ?");
        assert.ok(t.includes("users"));
        assert.ok(!t.includes("select"));
        assert.ok(!t.includes("from"));
        assert.ok(!t.includes("where"));
    });
    test("dedupes and caps length", () => {
        const long = Array.from({ length: 20 }, (_, i) => `t${i}`).join(" ");
        const out = (0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)(long);
        assert.strictEqual(out.length, 12);
        assert.strictEqual(new Set(out).size, 12);
    });
    test("all-stopwords fingerprint yields no tokens (avoid indexer noise)", () => {
        assert.deepStrictEqual((0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)("select from where and or join on"), []);
    });
    test("skips numeric-only tokens and ? placeholders", () => {
        const out = (0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)("? 12 3.14 users 99");
        assert.deepStrictEqual(out, ["users"]);
    });
    test("does not treat SQL-looking drift as table names when only keywords", () => {
        assert.deepStrictEqual((0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)("inner outer cross"), []);
    });
});
//# sourceMappingURL=drift-sql-fingerprint-code-tokens.test.js.map