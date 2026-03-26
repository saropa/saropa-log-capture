"use strict";
/**
 * Insights drill-down: fuzzy pattern builder, result grouping, and HTML renderer.
 *
 * Converts normalized error text (with placeholders) into a regex pattern
 * for cross-session search, groups results by session, and renders HTML.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFuzzyPattern = buildFuzzyPattern;
exports.groupMatchesBySession = groupMatchesBySession;
exports.renderDrillDownHtml = renderDrillDownHtml;
const ansi_1 = require("../../modules/capture/ansi");
/**
 * Convert normalized text (with <N>, <TS>, <UUID>, <HEX> placeholders)
 * into a fuzzy regex pattern that matches across sessions.
 */
function buildFuzzyPattern(normalizedText) {
    let pattern = normalizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = pattern.replace(/\\<TS\\>/g, '[\\d\\-T:. ]+');
    pattern = pattern.replace(/\\<UUID\\>/g, '[0-9a-f\\-]{36}');
    pattern = pattern.replace(/\\<HEX\\>/g, '0x[0-9a-fA-F]+');
    pattern = pattern.replace(/\\<N\\>/g, '\\d+');
    return pattern;
}
/** Group SearchMatch results by session filename. */
function groupMatchesBySession(matches) {
    const map = new Map();
    for (const m of matches) {
        let group = map.get(m.filename);
        if (!group) {
            group = { uri: m.uri.toString(), items: [] };
            map.set(m.filename, group);
        }
        group.items.push({ lineNumber: m.lineNumber, lineText: m.lineText });
    }
    return [...map.entries()].map(([filename, { uri, items }]) => ({
        sessionFilename: filename, uriString: uri, matches: items,
    }));
}
/** Render drill-down HTML for grouped matches. */
function renderDrillDownHtml(groups) {
    if (groups.length === 0) {
        return '<div class="drill-down-empty">No matches found in log files.</div>';
    }
    const total = groups.reduce((s, g) => s + g.matches.length, 0);
    let html = `<div class="drill-down-summary">${total} match${total !== 1 ? 'es' : ''} in ${groups.length} session${groups.length !== 1 ? 's' : ''}</div>`;
    for (const group of groups) {
        html += renderSessionGroup(group);
    }
    return html;
}
function renderSessionGroup(group) {
    let html = `<div class="drill-down-session">`;
    html += `<div class="drill-down-session-name">${(0, ansi_1.escapeHtml)(group.sessionFilename)} (${group.matches.length})</div>`;
    for (const m of group.matches) {
        const uri = (0, ansi_1.escapeHtml)(group.uriString);
        const text = (0, ansi_1.escapeHtml)(m.lineText.trim());
        html += `<div class="drill-down-match" data-uri="${uri}" data-filename="${(0, ansi_1.escapeHtml)(group.sessionFilename)}" data-line="${m.lineNumber}">`;
        html += `<span class="drill-down-line-num">L${m.lineNumber}</span>`;
        html += `<span class="drill-down-line-text">${text}</span></div>`;
    }
    return html + '</div>';
}
//# sourceMappingURL=insights-drill-down.js.map