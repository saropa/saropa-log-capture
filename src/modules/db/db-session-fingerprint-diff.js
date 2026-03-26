"use strict";
/**
 * Scan Saropa log file text for Drift `Sent` SQL and compare fingerprint summaries between two sessions (plan **DB_10**).
 * Aligns with `DbFingerprintSummaryEntry` and `parseDriftSqlFingerprint` / DB_02 normalization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_DB_FP_COMPARE_MAX_ROWS = void 0;
exports.elapsedMsFromSaropaRawLine = elapsedMsFromSaropaRawLine;
exports.saropaLogBodyLineStartIndex = saropaLogBodyLineStartIndex;
exports.scanSaropaLogDatabaseFingerprints = scanSaropaLogDatabaseFingerprints;
exports.buildDbFingerprintSummaryFromSaropaLogFileContent = buildDbFingerprintSummaryFromSaropaLogFileContent;
exports.findFirstPhysicalLineForDriftFingerprintInLog = findFirstPhysicalLineForDriftFingerprintInLog;
exports.rankSessionDbFingerprintChanges = rankSessionDbFingerprintChanges;
exports.regressionFingerprintsForRootCauseHints = regressionFingerprintsForRootCauseHints;
exports.compareScannedSaropaDbFingerprints = compareScannedSaropaDbFingerprints;
exports.compareSaropaLogDatabaseFingerprints = compareSaropaLogDatabaseFingerprints;
const ansi_1 = require("../capture/ansi");
const db_fingerprint_summary_1 = require("./db-fingerprint-summary");
const drift_n_plus_one_detector_1 = require("./drift-n-plus-one-detector");
const root_cause_hint_eligibility_1 = require("../root-cause-hints/root-cause-hint-eligibility");
/** Same token grammar as `viewer-file-loader.ts` `parseElapsedToMs` — keep in sync. */
function parseElapsedToken(elapsedStr) {
    const m = /^\+(\d+(?:\.\d+)?)(ms|s)$/.exec(elapsedStr);
    if (!m) {
        return undefined;
    }
    const val = Number.parseFloat(m[1]);
    if (!Number.isFinite(val) || val < 0) {
        return undefined;
    }
    return m[2] === "s" ? Math.round(val * 1000) : Math.round(val);
}
/**
 * Extract replay elapsed from Saropa bracketed lines when present (`[+Nms]` / `[+Ns]`).
 * Mirrors `parseFileLine` patterns in `viewer-file-loader.ts`.
 */
function elapsedMsFromSaropaRawLine(raw) {
    const timeElapsedCat = /^\[([\d:.]+)\]\s*\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (timeElapsedCat) {
        return parseElapsedToken(timeElapsedCat[2]);
    }
    const elapsedCat = /^\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (elapsedCat) {
        return parseElapsedToken(elapsedCat[1]);
    }
    return undefined;
}
/** Match `findHeaderEnd` in `viewer-file-loader.ts` — skip metadata before the `===` divider. */
function saropaLogBodyLineStartIndex(lines) {
    const limit = Math.min(lines.length, 50);
    for (let i = 0; i < limit; i++) {
        if (/^={10,}$/.test(lines[i].trim())) {
            const next = i + 1;
            if (next < lines.length && lines[next].trim() === "") {
                return next + 1;
            }
            return next;
        }
    }
    return 0;
}
function rawLineToDbDetectorContext(raw, seq) {
    const plain = (0, ansi_1.stripAnsi)(raw).trim();
    const parsed = (0, drift_n_plus_one_detector_1.parseDriftSqlFingerprint)(plain);
    if (!parsed) {
        return null;
    }
    return {
        timestampMs: seq,
        sessionId: null,
        sourceTag: "database",
        level: "info",
        plainText: plain,
        durationMs: elapsedMsFromSaropaRawLine(raw),
        sql: {
            fingerprint: parsed.fingerprint,
            argsKey: parsed.argsKey,
            sqlSnippet: parsed.sqlSnippet,
        },
    };
}
/**
 * Full scan: summary stats plus first physical line index per fingerprint (jump-to-line / persistence).
 */
function scanSaropaLogDatabaseFingerprints(content, opts) {
    const lines = content.split(/\r?\n/);
    const start = saropaLogBodyLineStartIndex(lines);
    const contexts = [];
    const firstLineByFingerprint = new Map();
    let seq = 0;
    for (let i = start; i < lines.length; i++) {
        const ctx = rawLineToDbDetectorContext(lines[i], seq++);
        if (ctx?.sql) {
            const fp = ctx.sql.fingerprint;
            if (!firstLineByFingerprint.has(fp)) {
                firstLineByFingerprint.set(fp, i);
            }
            contexts.push(ctx);
        }
    }
    const accOpts = typeof opts?.slowQueryMs === "number" && opts.slowQueryMs > 0
        ? { slowQueryMsThreshold: opts.slowQueryMs }
        : undefined;
    return {
        summary: (0, db_fingerprint_summary_1.buildDbFingerprintSummaryFromDetectorContexts)(contexts, accOpts),
        firstLineByFingerprint,
    };
}
/** Build fingerprint counts (and optional durations) from full log file UTF-8 text. */
function buildDbFingerprintSummaryFromSaropaLogFileContent(content) {
    return scanSaropaLogDatabaseFingerprints(content).summary;
}
/** Resolve first line for a normalized fingerprint (re-scan; use metadata hint when possible). */
function findFirstPhysicalLineForDriftFingerprintInLog(content, fingerprint) {
    return scanSaropaLogDatabaseFingerprints(content).firstLineByFingerprint.get(fingerprint);
}
function sumStatementCounts(map) {
    let n = 0;
    for (const e of map.values()) {
        n += e.count;
    }
    return n;
}
function interestScore(r) {
    const ad = r.avgDeltaMs !== undefined && r.avgDeltaMs > 0 ? r.avgDeltaMs : 0;
    switch (r.kind) {
        case "new":
            return 10_000 + r.countB * 10 + ad;
        case "removed":
            return 8_000 + r.countA * 10;
        case "more":
            return 5_000 + r.countDelta * 15 + ad;
        case "fewer":
            return 2_000 + Math.abs(r.countDelta);
        case "same":
            return 500 + ad * 2;
        default:
            return 0;
    }
}
/** One union row from `buildDbFingerprintSummaryDiff` → session compare row (counts, avg, slow). */
function sessionDbFingerprintRowFromDiff(d) {
    const b = d.baseline;
    const t = d.target;
    if (!b && !t) {
        return null;
    }
    const countA = b?.count ?? 0;
    const countB = t?.count ?? 0;
    const countDelta = countB - countA;
    let kind;
    if (!b) {
        kind = "new";
    }
    else if (!t) {
        kind = "removed";
    }
    else if (countDelta > 0) {
        kind = "more";
    }
    else if (countDelta < 0) {
        kind = "fewer";
    }
    else {
        kind = "same";
    }
    const avgA = b?.avgDurationMs;
    const avgB = t?.avgDurationMs;
    let avgDeltaMs;
    if (avgA !== undefined && avgB !== undefined) {
        avgDeltaMs = avgB - avgA;
    }
    const slowCountA = b?.slowQueryCount;
    const slowCountB = t?.slowQueryCount;
    const slowA = typeof slowCountA === "number" && slowCountA > 0 ? slowCountA : undefined;
    const slowB = typeof slowCountB === "number" && slowCountB > 0 ? slowCountB : undefined;
    // Delta uses 0 when a side omitted slow stats (no duration tokens or no threshold scan).
    let slowDelta;
    if (slowA !== undefined || slowB !== undefined) {
        slowDelta = (slowCountB ?? 0) - (slowCountA ?? 0);
    }
    return {
        fingerprint: d.fingerprint,
        kind,
        countA,
        countB,
        countDelta,
        avgA,
        avgB,
        avgDeltaMs,
        slowA,
        slowB,
        slowDelta,
    };
}
/**
 * Classify each fingerprint in the union of A/B and sort with regressions (more queries, higher avg) first.
 */
function rankSessionDbFingerprintChanges(baseline, target) {
    const diff = (0, db_fingerprint_summary_1.buildDbFingerprintSummaryDiff)(baseline, target);
    const rows = [];
    for (const d of diff) {
        const row = sessionDbFingerprintRowFromDiff(d);
        if (row) {
            rows.push(row);
        }
    }
    rows.sort((a, b) => interestScore(b) - interestScore(a));
    return rows;
}
const RCH_SESSION_DIFF_MAX_FP = 8;
/**
 * Fingerprints to surface as session-compare regression hypotheses in the log viewer (DB_14).
 * Aligns with `collectSessionDiffRegressionFpsEmbedded` thresholds: "new" needs leader-scale volume;
 * "more" needs a relative jump vs baseline A.
 */
function regressionFingerprintsForRootCauseHints(baseline, target) {
    const ranked = rankSessionDbFingerprintChanges(baseline, target);
    const out = [];
    for (const r of ranked) {
        if (r.kind === "new") {
            if (r.countB >= root_cause_hint_eligibility_1.ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
                out.push(r.fingerprint);
            }
        }
        else if (r.kind === "more") {
            const baseC = r.countA;
            const curC = r.countB;
            if (baseC > 0 && curC - baseC >= Math.max(3, Math.floor(baseC * 0.25))) {
                out.push(r.fingerprint);
            }
        }
        if (out.length >= RCH_SESSION_DIFF_MAX_FP) {
            break;
        }
    }
    return out;
}
/** Build compare view model from two pre-scanned bodies (one scan per file on the host). */
function compareScannedSaropaDbFingerprints(scanA, scanB) {
    const mapA = scanA.summary;
    const mapB = scanB.summary;
    const rows = rankSessionDbFingerprintChanges(mapA, mapB);
    const totalStatementsA = sumStatementCounts(mapA);
    const totalStatementsB = sumStatementCounts(mapB);
    const hasSlowQueryStats = rows.some((r) => r.slowA !== undefined || r.slowB !== undefined);
    return {
        totalStatementsA,
        totalStatementsB,
        distinctFingerprintsA: mapA.size,
        distinctFingerprintsB: mapB.size,
        rows,
        hasDriftSql: totalStatementsA + totalStatementsB > 0,
        hasSlowQueryStats,
        firstLineByFingerprintA: scanA.firstLineByFingerprint,
        firstLineByFingerprintB: scanB.firstLineByFingerprint,
    };
}
/** Session A = first file (baseline), session B = second file (target). */
function compareSaropaLogDatabaseFingerprints(textA, textB) {
    return compareScannedSaropaDbFingerprints(scanSaropaLogDatabaseFingerprints(textA), scanSaropaLogDatabaseFingerprints(textB));
}
/** Max rows to render in the session comparison webview (keeps HTML small). */
exports.SESSION_DB_FP_COMPARE_MAX_ROWS = 60;
//# sourceMappingURL=db-session-fingerprint-diff.js.map