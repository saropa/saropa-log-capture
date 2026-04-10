"use strict";
/**
 * Drift SQL log lines often end with ` with args [...]` (bound parameters). The args suffix
 * is visually dimmed to reduce noise while keeping the full text always visible.
 *
 * Split is applied on **raw** capture text before `ansiToHtml` so ANSI spans never straddle
 * the dim boundary.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trySplitDriftSqlArgsSuffix = trySplitDriftSqlArgsSuffix;
exports.buildDriftArgsDimHtml = buildDriftArgsDimHtml;
exports.ansiLinkifyLineHtml = ansiLinkifyLineHtml;
exports.buildLogLineHtmlWithOptionalDriftArgsDim = buildLogLineHtmlWithOptionalDriftArgsDim;
const ansi_1 = require("../capture/ansi");
const source_linker_1 = require("../source/source-linker");
const DRIFT_SENT = "Drift: Sent ";
/**
 * If `raw` is a Drift "Sent …" line with a ` with args ` tail, return prefix/suffix split.
 * Uses `lastIndexOf(' with args ')` on the post-`Drift: Sent ` body, matching
 * `parseSqlFingerprint` in `viewer-data-n-plus-one-script.ts`.
 */
function trySplitDriftSqlArgsSuffix(raw) {
    const sentIdx = raw.indexOf(DRIFT_SENT);
    if (sentIdx < 0) {
        return null;
    }
    const bodyStart = sentIdx + DRIFT_SENT.length;
    const body = raw.substring(bodyStart);
    const argsIdx = body.lastIndexOf(" with args ");
    if (argsIdx < 0) {
        return null;
    }
    const suffix = body.substring(argsIdx);
    const prefix = raw.substring(0, bodyStart + argsIdx);
    return { prefix, suffix };
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