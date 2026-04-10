"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAnsi = stripAnsi;
exports.formatElapsedLabel = formatElapsedLabel;
exports.escapeHtml = escapeHtml;
exports.ansiToHtml = ansiToHtml;
/** Regex matching ANSI escape sequences (SGR and cursor codes). */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
/** Standard foreground colors (SGR 30-37). Uses VS Code CSS variables so ANSI colors match the active theme. */
const standardFg = {
    30: 'var(--vscode-terminal-ansiBlack, #000)',
    31: 'var(--vscode-terminal-ansiRed, #cd3131)',
    32: 'var(--vscode-terminal-ansiGreen, #0dbc79)',
    33: 'var(--vscode-terminal-ansiYellow, #e5e510)',
    34: 'var(--vscode-terminal-ansiBlue, #2472c8)',
    35: 'var(--vscode-terminal-ansiMagenta, #bc3fbc)',
    36: 'var(--vscode-terminal-ansiCyan, #11a8cd)',
    37: 'var(--vscode-terminal-ansiWhite, #e5e5e5)',
};
/** Bright foreground colors (SGR 90-97). Uses VS Code CSS variables so ANSI colors match the active theme. */
const brightFg = {
    90: 'var(--vscode-terminal-ansiBrightBlack, #666)',
    91: 'var(--vscode-terminal-ansiBrightRed, #f14c4c)',
    92: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
    93: 'var(--vscode-terminal-ansiBrightYellow, #f5f543)',
    94: 'var(--vscode-terminal-ansiBrightBlue, #3b8eea)',
    95: 'var(--vscode-terminal-ansiBrightMagenta, #d670d6)',
    96: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
    97: 'var(--vscode-terminal-ansiBrightWhite, #fff)',
};
/** Standard background colors (SGR 40-47). Uses VS Code CSS variables so ANSI colors match the active theme. */
const standardBg = {
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
const brightBg = {
    100: 'var(--vscode-terminal-ansiBrightBlack, #666)',
    101: 'var(--vscode-terminal-ansiBrightRed, #f14c4c)',
    102: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
    103: 'var(--vscode-terminal-ansiBrightYellow, #f5f543)',
    104: 'var(--vscode-terminal-ansiBrightBlue, #3b8eea)',
    105: 'var(--vscode-terminal-ansiBrightMagenta, #d670d6)',
    106: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
    107: 'var(--vscode-terminal-ansiBrightWhite, #fff)',
};
/** Strip ANSI escape codes from text for plain-text display. */
function stripAnsi(text) {
    return text.replace(ANSI_REGEX, '');
}
/** Format a timestamp as a human-readable elapsed label ("just now", "42s ago", "3m ago"). */
function formatElapsedLabel(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 5) {
        return 'just now';
    }
    if (s < 60) {
        return `${s}s ago`;
    }
    return `${Math.round(s / 60)}m ago`;
}
/** Escape HTML special characters to prevent XSS when using innerHTML. */
function escapeHtml(text) {
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
 * Supports: reset, bold, dim, italic, underline, 16 fg/bg colors.
 */
function ansiToHtml(text) {
    if (!text.includes('\x1b[')) {
        return escapeHtml(text);
    }
    return convertSgrCodes(text);
}
/**
 * Parse all ANSI codes: convert SGR to spans, strip non-SGR.
 * Operates on raw text (with ANSI codes intact).
 */
function convertSgrCodes(raw) {
    const ansiPattern = /\x1b\[([0-9;]*)([a-zA-Z])/g;
    const parts = [];
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
function applySgrParams(state, paramStr) {
    if (!paramStr || paramStr === '0') {
        resetState(state);
        return;
    }
    for (const p of paramStr.split(';')) {
        applySingleParam(state, parseInt(p, 10) || 0);
    }
}
/** Apply a single SGR parameter code to the current state. */
function applySingleParam(state, code) {
    if (code === 0) {
        resetState(state);
        return;
    }
    if (code === 1) {
        state.bold = true;
        return;
    }
    if (code === 2) {
        state.dim = true;
        return;
    }
    if (code === 3) {
        state.italic = true;
        return;
    }
    if (code === 4) {
        state.underline = true;
        return;
    }
    if (code === 22) {
        state.bold = false;
        state.dim = false;
        return;
    }
    if (code === 23) {
        state.italic = false;
        return;
    }
    if (code === 24) {
        state.underline = false;
        return;
    }
    if (code === 39) {
        state.fg = null;
        return;
    }
    if (code === 49) {
        state.bg = null;
        return;
    }
    state.fg = standardFg[code] ?? brightFg[code] ?? state.fg;
    state.bg = standardBg[code] ?? brightBg[code] ?? state.bg;
}
/** Build an opening span tag from the current ANSI state. */
function buildSpanOpen(state) {
    const styles = [];
    if (state.fg) {
        styles.push(`color:${state.fg}`);
    }
    if (state.bg) {
        styles.push(`background-color:${state.bg}`);
    }
    if (state.bold) {
        styles.push('font-weight:bold');
    }
    if (state.dim) {
        styles.push('opacity:0.7');
    }
    if (state.italic) {
        styles.push('font-style:italic');
    }
    if (state.underline) {
        styles.push('text-decoration:underline');
    }
    return `<span style="${styles.join(';')}">`;
}
function createEmptyState() {
    return { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
}
function resetState(state) {
    state.bold = false;
    state.dim = false;
    state.italic = false;
    state.underline = false;
    state.fg = null;
    state.bg = null;
}
function isEmptyState(state) {
    return !state.bold && !state.dim && !state.italic && !state.underline
        && state.fg === null && state.bg === null;
}
//# sourceMappingURL=ansi.js.map