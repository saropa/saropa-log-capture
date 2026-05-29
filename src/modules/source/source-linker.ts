/**
 * Source link detection and linkification. Extracts file:line[:col] from log text for
 * inline decorations and open-in-editor; linkifyHtml wraps matches in clickable tags in the webview.
 */

import { escapeHtml } from '../capture/ansi';

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
 * Matches two stack-frame shapes in one alternation so a single replace pass
 * catches both — keeps capture-group bookkeeping consistent for the callback.
 *
 * Branch A — colon-attached: `path/file.ext:line` or `path/file.ext:line:col`.
 *   Captures: 1=path 2=ext 3=line 4=col(opt) ; branch-B groups are undefined.
 * Branch B — Dart `stack_trace` Trace.toString(): `path/file.ext LINE:COL`
 *   (one+ spaces between filename and line:col; col MANDATORY to avoid
 *   matching prose like "edit foo.dart 42 changes").
 *   Captures: 5=path 6=ext 7=line 8=col ; branch-A groups are undefined.
 *
 * Path may include slashes, dots, colons (drive letters), dashes, underscores.
 * Extension must be from the source-extension whitelist (injected at build time).
 */
const FILE_LINE_PATTERN =
    /([\w./\\:~-]+\.(EXT_SET)):(\d+)(?::(\d+))?|([\w./\\:~-]+\.(EXT_SET)) +(\d+):(\d+)/g;

/** Build the regex with the actual extension set. */
function buildPattern(): RegExp {
    const extAlt = [...sourceExtensions].join('|');
    const src = FILE_LINE_PATTERN.source.replace(/EXT_SET/g, extAlt);
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
    return text.replace(fileLineRegex, (match: string, ...groups: (string | undefined)[]) => {
        // Branch A (colon-attached) uses groups 0..3 ; Branch B (Trace space-sep)
        // uses groups 4..7. Pick whichever branch matched by checking which path
        // group is defined. Combining into one regex keeps a single replace pass
        // — running two passes risks the second pattern wrapping path text the
        // first pass already turned into HTML.
        const filePath = groups[0] ?? groups[4];
        const line = groups[2] ?? groups[6];
        const col = groups[3] ?? groups[7];
        if (!filePath || !line) { return match; }
        if (isUrlPort(match, text)) { return match; }
        const safePath = escapeHtml(filePath);
        const colAttr = col ? ` data-col="${col}"` : '';
        // Replace the path portion of the match with per-segment spans so each
        // folder + the filename becomes an independently hoverable region.
        // Ctrl+hover + Ctrl+click on a segment then filters the log to lines
        // containing that cumulative prefix. The line:col tail (the part of
        // the match after the path) stays as plain text inside the <a>, so
        // clicking it (Ctrl or not) routes to the existing open-file action.
        const pathSpans = buildPathSegmentSpans(filePath);
        const tailRaw = match.slice(filePath.length);
        const tailHtml = escapeHtml(tailRaw);
        return `<a class="source-link" data-path="${safePath}" data-line="${line}"${colAttr}>${pathSpans}${tailHtml}</a>`;
    });
}

/**
 * Split a path into per-segment spans, each carrying the CUMULATIVE prefix
 * up to and including that segment. CSS `:has(~ :hover)` then turns hovering
 * any segment into a highlight of all earlier siblings plus the hovered one
 * (the prefix that a Ctrl+click would filter on).
 *
 * Leading `./` and `/` are merged into the FIRST real folder so the very
 * first span is `./lib/` (or `/usr/`), not a useless `./` alone — clicking
 * "./" would have filtered to every relative path in the log.
 */
function buildPathSegmentSpans(filePath: string): string {
    const parts = filePath.split('/');
    // Merge a leading `.` or empty (from absolute paths) into the next part.
    if (parts.length > 1 && (parts[0] === '.' || parts[0] === '')) {
        parts[1] = parts[0] + '/' + parts[1];
        parts.shift();
    }
    let cumulative = '';
    const spans: string[] = [];
    parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        const seg = part + (isLast ? '' : '/');
        cumulative += seg;
        // Skip an empty trailing segment (path ending with `/` would emit "").
        if (!seg) { return; }
        spans.push(
            `<span class="source-link-seg" data-prefix="${escapeHtml(cumulative)}">${escapeHtml(seg)}</span>`,
        );
    });
    return spans.join('');
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

/**
 * Bare absolute paths (no `:line[:col]` tail), e.g. Claude Code Edit/Write
 * tool calls that surface as `[AI Edit] d:/src/contacts/lib/foo.dart` rows.
 *
 * Conservative pattern — must START with either a Windows drive letter
 * (`d:/`, `D:\`) or a POSIX root (`/`). Bare relative paths and single
 * filenames are intentionally NOT matched: linkifying prose mentions
 * like "see foo.dart" or "lib/foo.dart for context" causes false
 * positives and contradicts the deliberate negative-case in
 * `linkifyHtml` ("see foo.dart 42 description" must stay plain).
 *
 * Negative lookbehind `(?<![\w./\\:~-])` ensures the path starts at a
 * word/path boundary — without it the leading `/` could attach itself
 * mid-string and falsely match the `/foo.dart` inside `lib/foo.dart`
 * (relative path) or `https://example.com/foo.dart` (URL).
 *
 * Branches A/B in `linkifyHtml` still own paths that carry a line/col
 * tail; this branch only fires for the bare-path case those branches
 * deliberately skip. Opens at line 1 (the only sensible default).
 */
const BARE_PATH_PATTERN_SRC =
    `(?<![\\w./\\\\:~-])(?:[A-Za-z]:[\\\\/]|/)[\\w./\\\\:~-]+\\.(EXT_SET)\\b`;

function buildBarePathPattern(): RegExp {
    const extAlt = [...sourceExtensions].join('|');
    const src = BARE_PATH_PATTERN_SRC.replace(/EXT_SET/g, extAlt);
    return new RegExp(src, 'g');
}

const barePathRegex = buildBarePathPattern();

/**
 * Wrap bare absolute paths in `<a class="source-link">` tags. Used for AI
 * activity lines (`[AI Edit] d:/src/contacts/lib/foo.dart`) which lack the
 * `:line` tail the stack-frame linkifier requires. Splits on HTML tags so
 * already-wrapped content (e.g. existing source-links from `linkifyHtml`)
 * is not double-linkified.
 */
export function linkifyBarePaths(html: string): string {
    if (!html) { return html; }
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
        if (tag) {
            return tag;
        }
        return linkifyBarePathSegment(text!);
    });
}

function linkifyBarePathSegment(text: string): string {
    barePathRegex.lastIndex = 0;
    return text.replace(barePathRegex, (match: string) => {
        // Normalize backslashes for display; original match still wraps the
        // path verbatim so the click handler receives the unmodified path.
        const safePath = escapeHtml(match);
        const pathSpans = buildPathSegmentSpans(match.replace(/\\/g, '/'));
        return `<a class="source-link" data-path="${safePath}" data-line="1">${pathSpans}</a>`;
    });
}

/** A parsed source reference from a log line. */
export interface SourceReference {
    readonly filePath: string;
    readonly line: number;
    readonly col?: number;
}

/**
 * Extract the first source reference (file:line) from a log line.
 * Returns undefined if no valid source reference is found.
 */
export function extractSourceReference(text: string): SourceReference | undefined {
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

    // Same branch picking as linkifyTextSegment — branch A occupies groups 1..4,
    // branch B occupies groups 5..8. Whichever branch matched has a defined path.
    const filePath = match[1] ?? match[5];
    const lineStr = match[3] ?? match[7];
    const colStr = match[4] ?? match[8];
    if (!filePath || !lineStr) { return undefined; }

    return {
        filePath,
        line: parseInt(lineStr, 10),
        col: colStr ? parseInt(colStr, 10) : undefined,
    };
}

/** Extract a package hint from a stack frame for workspace file disambiguation. */
export function extractPackageHint(frameText: string): string | undefined {
    const dart = frameText.match(/package:([^/]+)/);
    if (dart) { return dart[1]; }
    const java = frameText.match(/\b((?:[a-z]\w*\.){2,})[A-Z]/);
    if (java) { return java[1].replace(/\.$/, ''); }
    return undefined;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/**
 * Wrap URL patterns in HTML text as clickable links with data attributes.
 * Operates on already-HTML-escaped text, same tag-splitting as linkifyHtml.
 */
export function linkifyUrls(html: string): string {
    if (!html.includes('://')) { return html; }
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag: string | undefined, text: string | undefined) => {
        if (tag) { return tag; }
        return linkifyUrlSegment(text!);
    });
}

/** Input text is already HTML-escaped — no re-escaping needed. */
function linkifyUrlSegment(text: string): string {
    return text.replace(URL_PATTERN, (url) => {
        const clean = url.replace(/[.,;:!?)]+$/, '');
        const trailing = url.slice(clean.length);
        return `<a class="url-link" data-url="${clean}">${clean}</a>${trailing}`;
    });
}
