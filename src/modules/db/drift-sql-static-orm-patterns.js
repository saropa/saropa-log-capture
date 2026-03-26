"use strict";
/**
 * DB_12: Drift-oriented static search patterns from normalized SQL fingerprints.
 * Mapping rows drive extra indexer tokens (broadened recall) and line-level hints; suggestive only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIFT_STATIC_ORM_PATTERN_ROWS = void 0;
exports.fingerprintHasWord = fingerprintHasWord;
exports.tableTokenToDartClassHints = tableTokenToDartClassHints;
exports.pathMatchesStaticSqlGlob = pathMatchesStaticSqlGlob;
exports.pathMatchesAnyStaticSqlGlob = pathMatchesAnyStaticSqlGlob;
exports.buildDriftStaticSqlSearchPlan = buildDriftStaticSqlSearchPlan;
const drift_sql_fingerprint_code_tokens_1 = require("./drift-sql-fingerprint-code-tokens");
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** True if `word` appears as a whole word in the fingerprint (lowercased SQL). */
function fingerprintHasWord(fingerprintLower, word) {
    const re = new RegExp(`\\b${escapeRegExp(word.toLowerCase())}\\b`);
    return re.test(fingerprintLower);
}
/**
 * Ordered rules: first matching rows contribute extra tokens and line hints (later rows may still add hints if matched).
 * Tokens from all matching rows are merged.
 */
const DART_SOURCES_GLOB = "**/*.dart";
exports.DRIFT_STATIC_ORM_PATTERN_ROWS = [
    {
        id: "drift-insert",
        fingerprintWordsAll: ["insert"],
        extraIndexerTokens: ["companion", "into"],
        optionalPathGlobPatterns: [DART_SOURCES_GLOB],
        rationale: "Drift inserts often use generated Companion classes and insert/insertAll APIs.",
    },
    {
        id: "drift-update",
        fingerprintWordsAll: ["update"],
        extraIndexerTokens: ["companion", "update"],
        optionalPathGlobPatterns: [DART_SOURCES_GLOB],
        rationale: "Drift updates frequently reference Companion builders and update calls.",
    },
    {
        id: "drift-delete",
        fingerprintWordsAll: ["delete"],
        extraIndexerTokens: ["delete"],
        optionalPathGlobPatterns: [DART_SOURCES_GLOB],
        rationale: "Delete-shaped SQL aligns with delete/deleteWhere in query code.",
    },
    {
        id: "drift-select-join",
        fingerprintWordsAll: ["select", "join"],
        extraIndexerTokens: ["innerjoin", "leftjoin"],
        optionalPathGlobPatterns: [DART_SOURCES_GLOB],
        rationale: "Joined selects often map to Drift join/innerJoin in Dart.",
    },
    {
        id: "drift-select-read",
        fingerprintWordsAll: ["select"],
        extraIndexerTokens: ["watch", "getsingle"],
        optionalPathGlobPatterns: [DART_SOURCES_GLOB],
        rationale: "Select-shaped SQL often appears near watch/get/read query APIs.",
    },
];
const MAX_INDEXER_TOKENS = 20;
/** `snake_case` or plain table token → likely Dart table class name(s). */
function tableTokenToDartClassHints(tableToken) {
    const t = tableToken.trim();
    if (!t) {
        return [];
    }
    const parts = t.split("_").filter(Boolean);
    const pascal = parts.map((p) => (p.length ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "")).join("");
    if (!pascal) {
        return [];
    }
    return [pascal];
}
/**
 * Match workspace-relative paths (forward slashes) against a small glob subset.
 * Supports recursive any-depth suffix patterns (see regex in implementation) and directory-prefix patterns ending in slash-double-star after normalization.
 */
function pathMatchesStaticSqlGlob(relativePath, pattern) {
    const norm = relativePath.replace(/\\/g, "/").toLowerCase();
    const pat = pattern.trim().toLowerCase();
    const starExt = /^\*\*\/\*\.([a-z0-9]+)$/.exec(pat);
    if (starExt) {
        return norm.endsWith(`.${starExt[1]}`);
    }
    if (pat.endsWith("/**")) {
        const prefix = pat.slice(0, -3);
        return norm === prefix || norm.startsWith(`${prefix}/`);
    }
    return true;
}
function pathMatchesAnyStaticSqlGlob(relativePath, patterns) {
    if (patterns.length === 0) {
        return true;
    }
    return patterns.some((p) => pathMatchesStaticSqlGlob(relativePath, p));
}
function mergeDedupeLower(tokens, cap) {
    const seen = new Set();
    const out = [];
    for (const raw of tokens) {
        const x = raw.toLowerCase().trim();
        if (!x || x.length < 2 || seen.has(x)) {
            continue;
        }
        seen.add(x);
        out.push(x);
        if (out.length >= cap) {
            break;
        }
    }
    return out;
}
/**
 * Build indexer tokens, primary table token, and Drift class / line hints for static source search.
 */
function buildDriftStaticSqlSearchPlan(fingerprint) {
    const fpLower = (fingerprint || "").toLowerCase();
    const base = (0, drift_sql_fingerprint_code_tokens_1.extractDriftFingerprintSearchTokens)(fingerprint);
    const primaryTableToken = base[0];
    const dartClassHints = primaryTableToken ? tableTokenToDartClassHints(primaryTableToken) : [];
    const extra = [];
    const globSet = new Set();
    for (const row of exports.DRIFT_STATIC_ORM_PATTERN_ROWS) {
        if (!row.fingerprintWordsAll.every((w) => fingerprintHasWord(fpLower, w))) {
            continue;
        }
        extra.push(...row.extraIndexerTokens);
        if (row.optionalPathGlobPatterns?.length) {
            for (const g of row.optionalPathGlobPatterns) {
                const gg = g.trim();
                if (gg) {
                    globSet.add(gg);
                }
            }
        }
    }
    const indexerTokens = mergeDedupeLower([...base, ...extra], MAX_INDEXER_TOKENS);
    let pathGlobPatterns = [...globSet];
    if (pathGlobPatterns.length === 0) {
        pathGlobPatterns = [DART_SOURCES_GLOB];
    }
    return {
        indexerTokens,
        primaryTableToken,
        dartClassHints,
        pathGlobPatterns,
    };
}
//# sourceMappingURL=drift-sql-static-orm-patterns.js.map