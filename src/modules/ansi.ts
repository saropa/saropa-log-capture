/** Regex matching ANSI escape sequences (SGR and cursor codes). */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** Standard foreground colors (SGR 30-37). Matched to VS Code terminal palette. */
const standardFg: Record<number, string> = {
    30: '#000', 31: '#cd3131', 32: '#0dbc79', 33: '#e5e510',
    34: '#2472c8', 35: '#bc3fbc', 36: '#11a8cd', 37: '#e5e5e5',
};

/** Bright foreground colors (SGR 90-97). Matched to VS Code terminal bright palette. */
const brightFg: Record<number, string> = {
    90: '#666', 91: '#f14c4c', 92: '#23d18b', 93: '#f5f543',
    94: '#3b8eea', 95: '#d670d6', 96: '#29b8db', 97: '#fff',
};

/** Standard background colors (SGR 40-47). Matched to VS Code terminal palette. */
const standardBg: Record<number, string> = {
    40: '#000', 41: '#cd3131', 42: '#0dbc79', 43: '#e5e510',
    44: '#2472c8', 45: '#bc3fbc', 46: '#11a8cd', 47: '#e5e5e5',
};

/** Bright background colors (SGR 100-107). Matched to VS Code terminal bright palette. */
const brightBg: Record<number, string> = {
    100: '#666', 101: '#f14c4c', 102: '#23d18b', 103: '#f5f543',
    104: '#3b8eea', 105: '#d670d6', 106: '#29b8db', 107: '#fff',
};

interface AnsiState {
    bold: boolean;
    dim: boolean;
    italic: boolean;
    underline: boolean;
    fg: string | null;
    bg: string | null;
}

/** Strip ANSI escape codes from text for plain-text display. */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
}

/** Escape HTML special characters to prevent XSS when using innerHTML. */
export function escapeHtml(text: string): string {
    return text
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
 * Supports: reset, bold, dim, italic, underline, 16 fg/bg colors.
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
    if (code === 39) { state.fg = null; return; }
    if (code === 49) { state.bg = null; return; }
    state.fg = standardFg[code] ?? brightFg[code] ?? state.fg;
    state.bg = standardBg[code] ?? brightBg[code] ?? state.bg;
}

/** Build an opening span tag from the current ANSI state. */
function buildSpanOpen(state: AnsiState): string {
    const styles: string[] = [];
    if (state.fg) { styles.push(`color:${state.fg}`); }
    if (state.bg) { styles.push(`background-color:${state.bg}`); }
    if (state.bold) { styles.push('font-weight:bold'); }
    if (state.dim) { styles.push('opacity:0.7'); }
    if (state.italic) { styles.push('font-style:italic'); }
    if (state.underline) { styles.push('text-decoration:underline'); }
    return `<span style="${styles.join(';')}">`;
}

function createEmptyState(): AnsiState {
    return { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
}

function resetState(state: AnsiState): void {
    state.bold = false;
    state.dim = false;
    state.italic = false;
    state.underline = false;
    state.fg = null;
    state.bg = null;
}

function isEmptyState(state: AnsiState): boolean {
    return !state.bold && !state.dim && !state.italic && !state.underline
        && state.fg === null && state.bg === null;
}
