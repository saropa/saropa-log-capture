"use strict";
/**
 * Drift SQL log lines often end with ` with args [...]` (bound parameters). Collapsing that
 * suffix behind a clickable ellipsis keeps noisy PRAGMA / introspection lines readable while
 * preserving the full text when expanded (see webview `.drift-args-fold` + click handler).
 *
 * Split is applied on **raw** capture text before `ansiToHtml` so ANSI spans never straddle
 * the fold boundary.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trySplitDriftSqlArgsSuffix = trySplitDriftSqlArgsSuffix;
exports.buildDriftArgsFoldHtml = buildDriftArgsFoldHtml;
exports.ansiLinkifyLineHtml = ansiLinkifyLineHtml;
exports.buildLogLineHtmlWithOptionalDriftArgsFold = buildLogLineHtmlWithOptionalDriftArgsFold;
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
function escapeAttrTitle(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
/** Inline HTML: ellipsis button (tooltip = full suffix) + hidden-until-open suffix span. */
function buildDriftArgsFoldHtml(suffixRaw) {
    const escBody = (0, ansi_1.escapeHtml)(suffixRaw);
    const title = escapeAttrTitle(suffixRaw);
    return ('<span class="drift-args-fold">'
        + '<button type="button" class="drift-args-fold-btn" aria-expanded="false" tabindex="0" title="'
        + title
        + '">'
        + '<span class="dcf-lbl-collapsed">\u2026</span><span class="dcf-lbl-expanded">\u25be</span>'
        + "</button>"
        + '<span class="drift-args-suffix">'
        + escBody
        + "</span>"
        + "</span>");
}
function ansiLinkifyLineHtml(raw) {
    return (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(raw)));
}
/** ANSI + linkify, with Drift ` with args ` tail folded when applicable. */
function buildLogLineHtmlWithOptionalDriftArgsFold(raw) {
    const sp = trySplitDriftSqlArgsSuffix(raw);
    if (!sp) {
        return ansiLinkifyLineHtml(raw);
    }
    return ansiLinkifyLineHtml(sp.prefix) + buildDriftArgsFoldHtml(sp.suffix);
}
//# sourceMappingURL=drift-log-line-args-fold.js.map