/**
 * Token extraction for project index: markdown headings and keywords.
 * Used by project-indexer for docs/bugs sources (not reports).
 */

const STOP_WORDS = new Set([
    'the', 'and', 'is', 'for', 'with', 'this', 'that', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'from', 'into', 'about', 'when',
    'which', 'what', 'who', 'how', 'where', 'than', 'because', 'after', 'before', 'during', 'while',
]);

const MIN_TOKEN_LEN = 3;
const MAX_TOKENS_PER_FILE = 500;

export interface HeadingEntry {
    readonly level: number;
    readonly text: string;
    readonly line: number;
}

/** Extract H1–H3 headings from markdown. Line is 1-based. */
export function extractHeadings(content: string): HeadingEntry[] {
    const headings: HeadingEntry[] = [];
    const lines = content.split(/\r?\n/);
    const re = /^(#{1,3})\s+(.+)$/;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (m) { headings.push({ level: m[1].length, text: m[2].trim(), line: i + 1 }); }
    }
    return headings;
}

/** Normalize and filter a single token. */
function normalizeToken(t: string): string | undefined {
    const s = t.toLowerCase().replace(/^\W+|\W+$/g, '');
    if (s.length < MIN_TOKEN_LEN || STOP_WORDS.has(s)) { return undefined; }
    return s;
}

/** Collect tokens from text (whitespace/punctuation split), dedupe, cap. */
function collectTokens(text: string, into: Set<string>, cap: number): void {
    const parts = text.split(/[\s\p{P}]+/u);
    for (const p of parts) {
        if (into.size >= cap) { return; }
        const t = normalizeToken(p);
        if (t) { into.add(t); }
    }
}

/** Extract tokens from plain text (e.g. .txt). */
export function extractTokensFromText(content: string): string[] {
    const set = new Set<string>();
    collectTokens(content, set, MAX_TOKENS_PER_FILE);
    return [...set];
}

/** Extract tokens from markdown: headings (2x), code blocks, bold/italic, links, then rest. */
export function extractTokensFromMarkdown(content: string): { tokens: string[]; headings: HeadingEntry[] } {
    const headings = extractHeadings(content);
    const set = new Set<string>();
    const cap = MAX_TOKENS_PER_FILE;
    for (const h of headings) {
        if (set.size >= cap) { break; }
        collectTokens(h.text, set, cap);
    }
    const codeBlockRe = /```[\s\S]*?```/g;
    const noCode = content.replace(codeBlockRe, ' ');
    const boldRe = /\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_/g;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(noCode)) !== null && set.size < cap) {
        const t = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
        if (t) { collectTokens(t, set, cap); }
    }
    const linkRe = /\[([^\]]+)\]\([^)]+\)/g;
    while ((m = linkRe.exec(noCode)) !== null && set.size < cap) {
        collectTokens(m[1], set, cap);
    }
    collectTokens(noCode.replace(/```[\s\S]*?```/g, ' '), set, cap);
    return { tokens: [...set], headings };
}
