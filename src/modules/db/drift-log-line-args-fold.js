"use strict";
/**
 * Drift SQL log lines often end with ` with args [...]` or ` | args: [...]` (bound
 * parameters). The args suffix is visually dimmed to reduce noise while keeping
 * the full text always visible.
 *
 * Split is applied on **raw** capture text before `ansiToHtml` so ANSI spans never
 * straddle the dim boundary.
 *
 * Supports two formats:
 *   Standard LogInterceptor:      `Drift: Sent SELECT … with args [...]`
 *   DriftDebugInterceptor:        `Drift SELECT: SELECT …; | args: [...]`
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trySplitDriftSqlArgsSuffix = trySplitDriftSqlArgsSuffix;
exports.buildDriftArgsDimHtml = buildDriftArgsDimHtml;
exports.ansiLinkifyLineHtml = ansiLinkifyLineHtml;
exports.buildLogLineHtmlWithOptionalDriftArgsDim = buildLogLineHtmlWithOptionalDriftArgsDim;
const ansi_1 = require("../capture/ansi");
const source_linker_1 = require("../source/source-linker");
const DRIFT_SENT = "Drift: Sent ";
/** DriftDebugInterceptor verb-colon prefix, e.g. "Drift SELECT:". */
const DRIFT_VERB_COLON_RE = /\bDrift\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\s*:/i;
/**
 * If `raw` is a Drift SQL line with an args tail, return prefix/suffix split.
 * Handles both ` with args ` (standard) and ` | args: ` (DriftDebugInterceptor).
 */
function trySplitDriftSqlArgsSuffix(raw) {
    /* Try standard format: "Drift: Sent" */
    const sentIdx = raw.indexOf(DRIFT_SENT);
    if (sentIdx >= 0) {
        const bodyStart = sentIdx + DRIFT_SENT.length;
        const body = raw.substring(bodyStart);
        const argsIdx = body.lastIndexOf(" with args ");
        if (argsIdx < 0) {
            return null;
        }
        return { prefix: raw.substring(0, bodyStart + argsIdx), suffix: body.substring(argsIdx) };
    }
    /* Try DriftDebugInterceptor: "Drift SELECT:" */
    const vcMatch = DRIFT_VERB_COLON_RE.exec(raw);
    if (!vcMatch) {
        return null;
    }
    const colonIdx = raw.indexOf(':', vcMatch.index + 5);
    if (colonIdx < 0) {
        return null;
    }
    const body = raw.substring(colonIdx + 1);
    /* Primary: " | args: "; fallback: " with args " */
    let argsIdx = body.lastIndexOf(" | args: ");
    if (argsIdx < 0) {
        argsIdx = body.lastIndexOf(" with args ");
    }
    if (argsIdx < 0) {
        return null;
    }
    return { prefix: raw.substring(0, colonIdx + 1 + argsIdx), suffix: body.substring(argsIdx) };
}
/** Inline HTML: always-visible but dimmed args suffix. */
function buildDriftArgsDimHtml(suffixRaw) {
    const escBody = (0, ansi_1.escapeHtml)(suffixRaw);
    return '<span class="drift-args-dim">' + escBody + "</span>";
}
function ansiLinkifyLineHtml(raw) {
    return (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(raw)));
}
/** ANSI + linkify, with Drift ` with args ` tail dimmed when applicable. */
function buildLogLineHtmlWithOptionalDriftArgsDim(raw) {
    const sp = trySplitDriftSqlArgsSuffix(raw);
    if (!sp) {
        return ansiLinkifyLineHtml(raw);
    }
    return ansiLinkifyLineHtml(sp.prefix) + buildDriftArgsDimHtml(sp.suffix);
}
//# sourceMappingURL=drift-log-line-args-fold.js.map