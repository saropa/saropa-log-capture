"use strict";
/**
 * DB_12: derive project-index search tokens from a normalized Drift SQL fingerprint (DB_02 shape).
 * Heuristic only — table/column-like tokens, not proof of execution site.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDriftFingerprintSearchTokens = extractDriftFingerprintSearchTokens;
const SQL_STOPWORDS = new Set([
    "select",
    "from",
    "where",
    "and",
    "or",
    "join",
    "inner",
    "left",
    "right",
    "outer",
    "cross",
    "on",
    "order",
    "by",
    "group",
    "having",
    "limit",
    "offset",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "with",
    "as",
    "case",
    "when",
    "then",
    "else",
    "end",
    "null",
    "not",
    "in",
    "is",
    "like",
    "between",
    "exists",
    "distinct",
    "all",
    "union",
    "create",
    "table",
    "index",
    "drop",
    "alter",
    "pragma",
    "begin",
    "commit",
    "rollback",
    "true",
    "false",
    "asc",
    "desc",
]);
const MAX_TOKENS = 12;
/**
 * Token list for `ProjectIndexer.queryDocEntriesByTokens` / ranking. Skips placeholders and SQL keywords.
 */
function extractDriftFingerprintSearchTokens(fingerprint) {
    const raw = (fingerprint || "").toLowerCase().trim();
    if (!raw) {
        return [];
    }
    const parts = raw.split(/\s+/).filter(Boolean);
    const out = [];
    const seen = new Set();
    for (const p of parts) {
        if (p === "?" || p.length < 2) {
            continue;
        }
        if (/^[\d.]+$/.test(p)) {
            continue;
        }
        if (SQL_STOPWORDS.has(p)) {
            continue;
        }
        if (seen.has(p)) {
            continue;
        }
        seen.add(p);
        out.push(p);
        if (out.length >= MAX_TOKENS) {
            break;
        }
    }
    return out;
}
//# sourceMappingURL=drift-sql-fingerprint-code-tokens.js.map