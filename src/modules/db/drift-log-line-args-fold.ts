/**
 * Drift SQL log lines often end with ` with args [...]` (bound parameters). The args suffix
 * is visually dimmed to reduce noise while keeping the full text always visible.
 *
 * Split is applied on **raw** capture text before `ansiToHtml` so ANSI spans never straddle
 * the dim boundary.
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

/** Inline HTML: always-visible but dimmed args suffix. */
export function buildDriftArgsDimHtml(suffixRaw: string): string {
    const escBody = escapeHtml(suffixRaw);
    return '<span class="drift-args-dim">' + escBody + "</span>";
}

export function ansiLinkifyLineHtml(raw: string): string {
    return linkifyUrls(linkifyHtml(ansiToHtml(raw)));
}

/** ANSI + linkify, with Drift ` with args ` tail dimmed when applicable. */
export function buildLogLineHtmlWithOptionalDriftArgsDim(raw: string): string {
    const sp = trySplitDriftSqlArgsSuffix(raw);
    if (!sp) {
        return ansiLinkifyLineHtml(raw);
    }
    return ansiLinkifyLineHtml(sp.prefix) + buildDriftArgsDimHtml(sp.suffix);
}
