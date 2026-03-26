"use strict";
/**
 * Source link detection and linkification. Extracts file:line[:col] from log text for
 * inline decorations and open-in-editor; linkifyHtml wraps matches in clickable tags in the webview.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkifyHtml = linkifyHtml;
exports.extractSourceReference = extractSourceReference;
exports.extractPackageHint = extractPackageHint;
exports.linkifyUrls = linkifyUrls;
const ansi_1 = require("../capture/ansi");
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
const FILE_LINE_PATTERN = /([\w./\\:~-]+\.(EXT_SET)):(\d+)(?::(\d+))?/g;
/** Build the regex with the actual extension set. */
function buildPattern() {
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
function linkifyHtml(html) {
    if (!html.includes(':')) {
        return html;
    }
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag, text) => {
        if (tag) {
            return tag;
        }
        return linkifyTextSegment(text);
    });
}
/** Apply file:line regex to a single text segment (no HTML tags). */
function linkifyTextSegment(text) {
    fileLineRegex.lastIndex = 0;
    // eslint-disable-next-line max-params -- regex capture groups
    return text.replace(fileLineRegex, (match, filePath, _ext, line, col) => {
        if (isUrlPort(match, text)) {
            return match;
        }
        const safePath = (0, ansi_1.escapeHtml)(filePath);
        const colAttr = col ? ` data-col="${col}"` : '';
        return `<a class="source-link" data-path="${safePath}" data-line="${line}"${colAttr}>${(0, ansi_1.escapeHtml)(match)}</a>`;
    });
}
/** Reject matches that are actually URL port numbers (e.g. localhost:8080). */
function isUrlPort(match, context) {
    const idx = context.indexOf(match);
    if (idx <= 0) {
        return false;
    }
    const before = context.slice(Math.max(0, idx - 10), idx);
    return /\/\/[^/]*$/.test(before);
}
/**
 * Extract the first source reference (file:line) from a log line.
 * Returns undefined if no valid source reference is found.
 */
function extractSourceReference(text) {
    if (!text.includes(':')) {
        return undefined;
    }
    fileLineRegex.lastIndex = 0;
    const match = fileLineRegex.exec(text);
    if (!match) {
        return undefined;
    }
    // Check if this is a URL port
    if (isUrlPort(match[0], text)) {
        return undefined;
    }
    return {
        filePath: match[1],
        line: parseInt(match[3], 10),
        col: match[4] ? parseInt(match[4], 10) : undefined,
    };
}
/** Extract a package hint from a stack frame for workspace file disambiguation. */
function extractPackageHint(frameText) {
    const dart = frameText.match(/package:([^/]+)/);
    if (dart) {
        return dart[1];
    }
    const java = frameText.match(/\b((?:[a-z]\w*\.){2,})[A-Z]/);
    if (java) {
        return java[1].replace(/\.$/, '');
    }
    return undefined;
}
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
/**
 * Wrap URL patterns in HTML text as clickable links with data attributes.
 * Operates on already-HTML-escaped text, same tag-splitting as linkifyHtml.
 */
function linkifyUrls(html) {
    if (!html.includes('://')) {
        return html;
    }
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag, text) => {
        if (tag) {
            return tag;
        }
        return linkifyUrlSegment(text);
    });
}
/** Input text is already HTML-escaped — no re-escaping needed. */
function linkifyUrlSegment(text) {
    return text.replace(URL_PATTERN, (url) => {
        const clean = url.replace(/[.,;:!?)]+$/, '');
        const trailing = url.slice(clean.length);
        return `<a class="url-link" data-url="${clean}">${clean}</a>${trailing}`;
    });
}
//# sourceMappingURL=source-linker.js.map