"use strict";
/**
 * Drift SQL — real-time repeat-collapse thresholds (plan DB_04)
 *
 * ## Purpose
 * The log viewer collapses consecutive duplicate lines into `repeat-notification` rows after **N**
 * identical occurrences within `repeatWindowMs` (see `viewer-data-add.ts` / `viewer-data-helpers-core.ts`).
 * For **`database`**-tagged Drift `Drift: Sent …` lines, **N** depends on the SQL verb so noisy reads
 * collapse sooner than DML.
 *
 * ## Host vs webview
 * - **Extension host:** `getConfig().viewerRepeatThresholds` is normalized here and passed into
 *   `buildViewerHtml` / `setViewerRepeatThresholds` messages.
 * - **Webview embed:** `getNPlusOneDetectorScript()` injects `dbRepeatThresholds` and
 *   `getDriftRepeatMinN()` — **must stay logically identical** to {@link driftSqlRepeatMinN} below.
 *   When changing verb buckets or fallbacks, update both and run `drift-db-repeat-thresholds.test.ts`
 *   plus `viewer-n-plus-one-embed.test.ts`.
 *
 * ## Not covered here
 * Optional compress-lines / global dedupe (`applyCompressDedupModes`); N+1 burst detector thresholds
 * (`drift-n-plus-one-detector.ts`).
 *
 * ## Settings
 * `saropaLogCapture.repeatCollapseGlobalMinCount`, `repeatCollapseReadMinCount`,
 * `repeatCollapseTransactionMinCount`, `repeatCollapseDmlMinCount` (each clamped 2–50).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIEWER_REPEAT_THRESHOLD_DEFAULTS = void 0;
exports.clampViewerRepeatMinCount = clampViewerRepeatMinCount;
exports.normalizeViewerRepeatThresholds = normalizeViewerRepeatThresholds;
exports.driftSqlRepeatMinN = driftSqlRepeatMinN;
exports.getDriftRepeatMinNJsSource = getDriftRepeatMinNJsSource;
/** Product defaults (before user settings). */
exports.VIEWER_REPEAT_THRESHOLD_DEFAULTS = {
    globalMinCount: 2,
    readMinCount: 2,
    transactionMinCount: 3,
    dmlMinCount: 4,
};
const MAX_REPEAT_MIN = 50;
const DRIFT_READ_VERBS = ["SELECT", "WITH", "PRAGMA"];
const DRIFT_TRANSACTION_VERBS = ["BEGIN", "COMMIT", "ROLLBACK"];
const DRIFT_DML_VERBS = ["INSERT", "UPDATE", "DELETE"];
/** Minimum occurrences before repeat-collapse; must be at least 2 to match legacy behavior floor. */
function clampViewerRepeatMinCount(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) {
        return exports.VIEWER_REPEAT_THRESHOLD_DEFAULTS.globalMinCount;
    }
    return Math.min(MAX_REPEAT_MIN, Math.max(2, Math.floor(n)));
}
function normalizeViewerRepeatThresholds(partial) {
    const d = exports.VIEWER_REPEAT_THRESHOLD_DEFAULTS;
    return {
        globalMinCount: clampViewerRepeatMinCount(partial?.globalMinCount ?? d.globalMinCount),
        readMinCount: clampViewerRepeatMinCount(partial?.readMinCount ?? d.readMinCount),
        transactionMinCount: clampViewerRepeatMinCount(partial?.transactionMinCount ?? d.transactionMinCount),
        dmlMinCount: clampViewerRepeatMinCount(partial?.dmlMinCount ?? d.dmlMinCount),
    };
}
/**
 * Threshold **N** for one line before repeat-collapse, mirroring the webview's `getDriftRepeatMinN`.
 *
 * - Non-`database` source tags always use **global** (Drift-shaped text on stderr without the tag
 *   must not pick read/DML thresholds — false-positive guard).
 * - `database` without a parsed verb uses **global**.
 * - Verbs outside the known sets fall back to **global** (future-proof if the log regex gains tokens
 *   before this mapping is updated).
 */
function driftSqlRepeatMinN(sourceTag, sqlVerb, t) {
    if (sourceTag !== "database" || !sqlVerb) {
        return t.globalMinCount;
    }
    const v = sqlVerb.toUpperCase();
    if (DRIFT_READ_VERBS.includes(v)) {
        return t.readMinCount;
    }
    if (DRIFT_TRANSACTION_VERBS.includes(v)) {
        return t.transactionMinCount;
    }
    if (DRIFT_DML_VERBS.includes(v)) {
        return t.dmlMinCount;
    }
    return t.globalMinCount;
}
/**
 * JS source for the webview-side `getDriftRepeatMinN` implementation.
 * Generated from the same verb buckets used by {@link driftSqlRepeatMinN}.
 */
function getDriftRepeatMinNJsSource() {
    const read = DRIFT_READ_VERBS.map((v) => `'${v}'`).join(",");
    const transaction = DRIFT_TRANSACTION_VERBS.map((v) => `'${v}'`).join(",");
    const dml = DRIFT_DML_VERBS.map((v) => `'${v}'`).join(",");
    return ("function getDriftRepeatMinN(sqlMeta, sourceTag) {\n"
        + "    if (sourceTag !== 'database' || !sqlMeta || !sqlMeta.verb) return dbRepeatThresholds.global;\n"
        + "    var v = String(sqlMeta.verb).toUpperCase();\n"
        + `    if (['${read.replace(/'/g, "").replace(/,/g, "','")}'].indexOf(v) >= 0) return dbRepeatThresholds.read;\n`
        + `    if (['${transaction.replace(/'/g, "").replace(/,/g, "','")}'].indexOf(v) >= 0) return dbRepeatThresholds.transaction;\n`
        + `    if (['${dml.replace(/'/g, "").replace(/,/g, "','")}'].indexOf(v) >= 0) return dbRepeatThresholds.dml;\n`
        + "    return dbRepeatThresholds.global;\n"
        + "}\n");
}
//# sourceMappingURL=drift-db-repeat-thresholds.js.map