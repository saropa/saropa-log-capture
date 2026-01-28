import { escapeHtml } from './ansi';

/**
 * Common source file extensions for click-to-source link detection.
 * Covers major languages used with VS Code debug adapters.
 */
const sourceExtensions = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'dart', 'py', 'java', 'go', 'rs', 'rb',
    'cpp', 'cc', 'c', 'h', 'hh', 'hpp',
    'cs', 'swift', 'kt', 'kts', 'scala',
    'php', 'lua', 'ex', 'exs', 'r', 'R',
    'vue', 'svelte', 'm', 'mm',
]);

/**
 * Matches `path/file.ext:line` or `path/file.ext:line:col`.
 * Path may include slashes, dots, colons (drive letters), dashes, underscores.
 * Extension must be from the source-extension whitelist (injected at build time).
 */
const FILE_LINE_PATTERN =
    /([\w./\\:~-]+\.(EXT_SET)):(\d+)(?::(\d+))?/g;

/** Build the regex with the actual extension set. */
function buildPattern(): RegExp {
    const extAlt = [...sourceExtensions].join('|');
    const src = FILE_LINE_PATTERN.source.replace('EXT_SET', extAlt);
    return new RegExp(src, 'g');
}

const fileLineRegex = buildPattern();

/**
 * Scan HTML text for `file.ext:line[:col]` patterns and wrap matches
 * in `<a class="source-link">` tags with data attributes.
 *
 * Operates on already-HTML-escaped text: splits on HTML tags so that
 * only text content (not attribute values) is linkified.
 */
export function linkifyHtml(html: string): string {
    if (!html.includes(':')) {
        return html;
    }
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
        if (tag) {
            return tag;
        }
        return linkifyTextSegment(text!);
    });
}

/** Apply file:line regex to a single text segment (no HTML tags). */
function linkifyTextSegment(text: string): string {
    fileLineRegex.lastIndex = 0;
    return text.replace(fileLineRegex, (match, filePath: string, _ext: string, line: string, col: string | undefined) => {
        if (isUrlPort(match, text)) {
            return match;
        }
        const safePath = escapeHtml(filePath);
        const colAttr = col ? ` data-col="${col}"` : '';
        return `<a class="source-link" data-path="${safePath}" data-line="${line}"${colAttr}>${escapeHtml(match)}</a>`;
    });
}

/** Reject matches that are actually URL port numbers (e.g. localhost:8080). */
function isUrlPort(match: string, context: string): boolean {
    const idx = context.indexOf(match);
    if (idx <= 0) {
        return false;
    }
    const before = context.slice(Math.max(0, idx - 10), idx);
    return /\/\/[^/]*$/.test(before);
}
