/**
 * Parse and compare CHANGELOG version headings so a crash can flag "changed since the affected
 * version — may already be fixed" (plan 054 Stage 5c-1). Pure string logic, no IO, so it is unit
 * tested directly with `node --test`.
 */

/** One CHANGELOG version entry: the version string and the first descriptive line beneath it. */
export interface ChangelogVersion {
    readonly version: string;
    readonly summary: string;
}

/** Result of locating an affected version in a changelog: whether it was found, and the newer entries. */
export interface ChangelogSince {
    readonly found: boolean;
    readonly since: readonly ChangelogVersion[];
}

// '## [1.2.3]' / '## 1.2.3' / '## v1.2.3' (optionally trailed by a date). Must start with a digit so
// '## [Unreleased]' and prose headings are skipped — "since" is about released versions.
const VERSION_HEADING = /^##\s+\[?v?([0-9][0-9A-Za-z.\-+]*)\]?/;

/** Strip a leading 'v' and surrounding whitespace so 'v1.2.3' and '1.2.3' compare equal. */
function normalizeVersion(v: string): string {
    return v.trim().replace(/^v/i, '');
}

/** First non-empty, non-structural line under a heading (its human summary); '' if none before the next heading. */
function firstSummaryLine(lines: readonly string[], from: number): string {
    for (let i = from; i < lines.length; i++) {
        const text = lines[i].trim();
        if (text.startsWith('#')) { return ''; }
        if (!text || text.startsWith('---') || text.startsWith('<!--')) { continue; }
        return text.replace(/^[-*]\s*/, '').slice(0, 200);
    }
    return '';
}

/**
 * Parse a CHANGELOG body into version entries in document order. Changelogs are reverse-chronological,
 * so the first entry is the newest release.
 */
export function parseChangelogVersions(text: string): ChangelogVersion[] {
    const lines = text.split(/\r?\n/);
    const out: ChangelogVersion[] = [];
    for (let i = 0; i < lines.length; i++) {
        const match = VERSION_HEADING.exec(lines[i]);
        if (match) { out.push({ version: match[1], summary: firstSummaryLine(lines, i + 1) }); }
    }
    return out;
}

/**
 * Versions newer than the affected one. Because entries are reverse-chronological, "newer" = entries
 * appearing BEFORE the affected entry in document order. `found` is false when the affected version is
 * absent — the caller must not imply "nothing changed" in that case.
 */
export function changelogSince(versions: readonly ChangelogVersion[], affected: string): ChangelogSince {
    const target = normalizeVersion(affected);
    const idx = versions.findIndex(v => normalizeVersion(v.version) === target);
    if (idx < 0) { return { found: false, since: [] }; }
    return { found: true, since: versions.slice(0, idx) };
}
