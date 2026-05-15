/** Regex matching ANSI escape sequences (SGR and cursor codes). */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

/*
 * ANSI FOREGROUND COLOR IS DELIBERATELY NOT RENDERED.
 *
 * Source ANSI foreground color cannot be trusted as a severity signal: in real
 * logs the same code is used across unrelated severities (e.g. a Flutter app
 * paints yellow `\e[33m` on notices, perf lines, warnings, AND decode failures;
 * green `\e[32m` just means "routine DB chatter"). Letting it tint the text
 * produced "looks like an error but is not under the E filter" — color and
 * filter membership disagreeing. Severity color is now owned 100% by the
 * level-* palette derived from item.level, so the level toggle and the on-row
 * color can never disagree. See plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md
 * Item D. Background colors, bold, dim, italic, underline are still honored —
 * they are not severity signals.
 */

/** Standard background colors (SGR 40-47). Uses VS Code CSS variables so ANSI colors match the active theme. */
const standardBg: Record<number, string> = {
    40: 'var(--vscode-terminal-ansiBlack, #000)',
    41: 'var(--vscode-terminal-ansiRed, #cd3131)',
    42: 'var(--vscode-terminal-ansiGreen, #0dbc79)',
    43: 'var(--vscode-terminal-ansiYellow, #e5e510)',
    44: 'var(--vscode-terminal-ansiBlue, #2472c8)',
    45: 'var(--vscode-terminal-ansiMagenta, #bc3fbc)',
    46: 'var(--vscode-terminal-ansiCyan, #11a8cd)',
    47: 'var(--vscode-terminal-ansiWhite, #e5e5e5)',
};

/** Bright background colors (SGR 100-107). Uses VS Code CSS variables so ANSI colors match the active theme. */
const brightBg: Record<number, string> = {
    100: 'var(--vscode-terminal-ansiBrightBlack, #666)',
    101: 'var(--vscode-terminal-ansiBrightRed, #f14c4c)',
    102: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
    103: 'var(--vscode-terminal-ansiBrightYellow, #f5f543)',
    104: 'var(--vscode-terminal-ansiBrightBlue, #3b8eea)',
    105: 'var(--vscode-terminal-ansiBrightMagenta, #d670d6)',
    106: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
    107: 'var(--vscode-terminal-ansiBrightWhite, #fff)',
};

interface AnsiState {
    bold: boolean;
    dim: boolean;
    italic: boolean;
    underline: boolean;
    bg: string | null;
}

/** Strip ANSI escape codes from text for plain-text display. */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
}

/** Format a timestamp as a human-readable elapsed label ("just now", "42s ago", "3m ago"). */
export function formatElapsedLabel(ts: number): string {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 5) { return 'just now'; }
    if (s < 60) { return `${s}s ago`; }
    return `${Math.round(s / 60)}m ago`;
}

/** Escape HTML special characters to prevent XSS when using innerHTML. */
export function escapeHtml(text: string): string {
    return text
        // Strip control characters (except tab and newline) to prevent tofu boxes in the webview.
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Convert ANSI SGR escape codes to HTML span elements.
 * Text is HTML-escaped before conversion to prevent XSS.
 * Non-SGR ANSI codes are silently stripped.
 * Supports: reset, bold, dim, italic, underline, 16 background colors.
 * Foreground colors are intentionally dropped — see the top-of-file comment.
 */
export function ansiToHtml(text: string): string {
    if (!text.includes('\x1b[')) {
        return escapeHtml(text);
    }
    return convertSgrCodes(text);
}

/**
 * Parse all ANSI codes: convert SGR to spans, strip non-SGR.
 * Operates on raw text (with ANSI codes intact).
 */
function convertSgrCodes(raw: string): string {
    const ansiPattern = /\x1b\[([0-9;]*)([a-zA-Z])/g;
    const parts: string[] = [];
    const state = createEmptyState();
    let spanOpen = false;
    let lastIndex = 0;
    let match = ansiPattern.exec(raw);

    while (match !== null) {
        const textBefore = raw.slice(lastIndex, match.index);
        if (textBefore) {
            parts.push(escapeHtml(textBefore));
        }

        if (match[2] === 'm') {
            if (spanOpen) {
                parts.push('</span>');
                spanOpen = false;
            }
            applySgrParams(state, match[1]);
            if (!isEmptyState(state)) {
                parts.push(buildSpanOpen(state));
                spanOpen = true;
            }
        }
        // Non-SGR codes (cursor, erase, etc.) are silently dropped.

        lastIndex = match.index + match[0].length;
        match = ansiPattern.exec(raw);
    }

    const trailing = raw.slice(lastIndex);
    if (trailing) {
        parts.push(escapeHtml(trailing));
    }
    if (spanOpen) {
        parts.push('</span>');
    }
    return parts.join('');
}

/** Apply a semicolon-separated list of SGR parameters to state. */
function applySgrParams(state: AnsiState, paramStr: string): void {
    if (!paramStr || paramStr === '0') {
        resetState(state);
        return;
    }
    for (const p of paramStr.split(';')) {
        applySingleParam(state, parseInt(p, 10) || 0);
    }
}

/** Apply a single SGR parameter code to the current state. */
function applySingleParam(state: AnsiState, code: number): void {
    if (code === 0) { resetState(state); return; }
    if (code === 1) { state.bold = true; return; }
    if (code === 2) { state.dim = true; return; }
    if (code === 3) { state.italic = true; return; }
    if (code === 4) { state.underline = true; return; }
    if (code === 22) { state.bold = false; state.dim = false; return; }
    if (code === 23) { state.italic = false; return; }
    if (code === 24) { state.underline = false; return; }
    if (code === 49) { state.bg = null; return; }
    // Foreground codes (30-37, 39, 90-97) intentionally ignored — see the
    // foreground-color block comment at the top of this file.
    state.bg = standardBg[code] ?? brightBg[code] ?? state.bg;
}

/** Build an opening span tag from the current ANSI state. */
function buildSpanOpen(state: AnsiState): string {
    const styles: string[] = [];
    if (state.bg) { styles.push(`background-color:${state.bg}`); }
    if (state.bold) { styles.push('font-weight:bold'); }
    if (state.dim) { styles.push('opacity:0.7'); }
    if (state.italic) { styles.push('font-style:italic'); }
    if (state.underline) { styles.push('text-decoration:underline'); }
    return `<span style="${styles.join(';')}">`;
}

function createEmptyState(): AnsiState {
    return { bold: false, dim: false, italic: false, underline: false, bg: null };
}

function resetState(state: AnsiState): void {
    state.bold = false;
    state.dim = false;
    state.italic = false;
    state.underline = false;
    state.bg = null;
}

function isEmptyState(state: AnsiState): boolean {
    return !state.bold && !state.dim && !state.italic && !state.underline
        && state.bg === null;
}
