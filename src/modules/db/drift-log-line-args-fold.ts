/**
 * Drift SQL log lines often end with ` with args [...]` (bound parameters). Collapsing that
 * suffix behind a clickable ellipsis keeps noisy PRAGMA / introspection lines readable while
 * preserving the full text when expanded (see webview `.drift-args-fold` + click handler).
 *
 * Split is applied on **raw** capture text before `ansiToHtml` so ANSI spans never straddle
 * the fold boundary.
 */

import { ansiToHtml, escapeHtml } from "../capture/ansi";
import { linkifyHtml, linkifyUrls } from "../source/source-linker";

const DRIFT_SENT = "Drift: Sent ";

/**
 * If `raw` is a Drift "Sent …" line with a ` with args ` tail, return prefix/suffix split.
 * Uses `lastIndexOf(' with args ')` on the post-`Drift: Sent ` body, matching
 * `parseSqlFingerprint` in `viewer-data-n-plus-one-script.ts`.
 */
export function trySplitDriftSqlArgsSuffix(raw: string): { prefix: string; suffix: string } | null {
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

function escapeAttrTitle(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Inline HTML: ellipsis button (tooltip = full suffix) + hidden-until-open suffix span. */
export function buildDriftArgsFoldHtml(suffixRaw: string): string {
    const escBody = escapeHtml(suffixRaw);
    const title = escapeAttrTitle(suffixRaw);
    return (
        '<span class="drift-args-fold">'
        + '<button type="button" class="drift-args-fold-btn" aria-expanded="false" tabindex="0" title="'
        + title
        + '">'
        + '<span class="dcf-lbl-collapsed">\u2026</span><span class="dcf-lbl-expanded">\u25be</span>'
        + "</button>"
        + '<span class="drift-args-suffix">'
        + escBody
        + "</span>"
        + "</span>"
    );
}

export function ansiLinkifyLineHtml(raw: string): string {
    return linkifyUrls(linkifyHtml(ansiToHtml(raw)));
}

/** ANSI + linkify, with Drift ` with args ` tail folded when applicable. */
export function buildLogLineHtmlWithOptionalDriftArgsFold(raw: string): string {
    const sp = trySplitDriftSqlArgsSuffix(raw);
    if (!sp) {
        return ansiLinkifyLineHtml(raw);
    }
    return ansiLinkifyLineHtml(sp.prefix) + buildDriftArgsFoldHtml(sp.suffix);
}
