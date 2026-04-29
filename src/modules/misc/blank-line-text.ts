/**
 * Shared rules for detecting “blank” log lines beyond ASCII space/tab/LF.
 *
 * Keep `normalizeForBlankCheck` / `decodeHtmlWhitespaceEntities` in sync with
 * `viewer-data-helpers-core.ts` (embedded webview script).
 */

import { stripAnsi } from "../capture/ansi";

/** Decimal code points treated as horizontal/vertical whitespace when seen as HTML entities. */
const HTML_ENTITY_WS = new Set<number>([
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288,
]);

const NBSP_LIKE = /[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g;
const ZW_AND_FORMAT = /[\u200B-\u200D\uFEFF\u2060-\u2064]/g;

/** Map numeric / hex HTML entities that denote Unicode whitespace to a regular space. */
export function decodeHtmlWhitespaceEntities(text: string): string {
  return text.replace(/&#(?:x([0-9a-fA-F]+)|([0-9]+));?/gi, (m, hex: string | undefined, dec: string | undefined) => {
    const n = hex !== undefined ? parseInt(hex, 16) : parseInt(dec ?? "0", 10);
    if (!Number.isFinite(n)) return m;
    return HTML_ENTITY_WS.has(n) ? " " : m;
  });
}

/** Strip BOM, NBSP-like spaces, ZWSP / word-joiner, common entities, and HTML numeric whitespace entities. */
export function normalizeTextForBlankLineCheck(text: string): string {
  let s = decodeHtmlWhitespaceEntities(text);
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/&nbsp;/gi, " ").replace(/&#160;/gi, " ").replace(/&#xA0;/gi, " ");
  s = s.replace(NBSP_LIKE, " ");
  s = s.replace(ZW_AND_FORMAT, "");
  return s;
}

/** True if plain text (after ANSI strip) is empty or whitespace only. */
export function isPlainTextBlankAfterAnsi(rawLine: string): boolean {
  const t = normalizeTextForBlankLineCheck(stripAnsi(rawLine));
  return /^\s*$/.test(t);
}
