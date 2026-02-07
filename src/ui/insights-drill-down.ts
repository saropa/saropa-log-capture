/**
 * Insights drill-down: fuzzy pattern builder, result grouping, and HTML renderer.
 *
 * Converts normalized error text (with placeholders) into a regex pattern
 * for cross-session search, groups results by session, and renders HTML.
 */

import { escapeHtml } from '../modules/ansi';
import type { SearchMatch } from '../modules/log-search';

/** A group of matches within a single session file. */
export interface DrillDownGroup {
    readonly sessionFilename: string;
    readonly uriString: string;
    readonly matches: readonly { lineNumber: number; lineText: string }[];
}

/**
 * Convert normalized text (with <N>, <TS>, <UUID>, <HEX> placeholders)
 * into a fuzzy regex pattern that matches across sessions.
 */
export function buildFuzzyPattern(normalizedText: string): string {
    let pattern = normalizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = pattern.replace(/\\<TS\\>/g, '[\\d\\-T:. ]+');
    pattern = pattern.replace(/\\<UUID\\>/g, '[0-9a-f\\-]{36}');
    pattern = pattern.replace(/\\<HEX\\>/g, '0x[0-9a-fA-F]+');
    pattern = pattern.replace(/\\<N\\>/g, '\\d+');
    return pattern;
}

/** Group SearchMatch results by session filename. */
export function groupMatchesBySession(matches: readonly SearchMatch[]): DrillDownGroup[] {
    const map = new Map<string, { uri: string; items: { lineNumber: number; lineText: string }[] }>();
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
export function renderDrillDownHtml(groups: readonly DrillDownGroup[]): string {
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

function renderSessionGroup(group: DrillDownGroup): string {
    let html = `<div class="drill-down-session">`;
    html += `<div class="drill-down-session-name">${escapeHtml(group.sessionFilename)} (${group.matches.length})</div>`;
    for (const m of group.matches) {
        const uri = escapeHtml(group.uriString);
        const text = escapeHtml(m.lineText.trim());
        html += `<div class="drill-down-match" data-uri="${uri}" data-filename="${escapeHtml(group.sessionFilename)}" data-line="${m.lineNumber}">`;
        html += `<span class="drill-down-line-num">L${m.lineNumber}</span>`;
        html += `<span class="drill-down-line-text">${text}</span></div>`;
    }
    return html + '</div>';
}
