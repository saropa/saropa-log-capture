/** Markdown formatter for the "Known Lint Issues" bug report section. */

import type { LintReportData, LintViolation } from './lint-violation-reader';

/** Format matched lint violations into a markdown section. */
export function formatLintSection(data: LintReportData): string {
    const count = data.matches.length;
    const noun = count === 1 ? 'violation' : 'violations';
    const lines = [
        `## Known Lint Issues`,
        `${count} lint ${noun} found in files appearing in this stack trace.`,
        formatTable(data.matches),
        formatSource(data),
    ];
    if (data.isStale) { lines.push(formatStaleness(data.timestamp)); }
    return lines.join('\n\n');
}

function formatTable(matches: readonly LintViolation[]): string {
    const header = '| File | Line | Rule | Impact | Message |';
    const sep = '|------|------|------|--------|---------|';
    const rows = matches.map(v => {
        const msg = escapePipe(v.message).slice(0, 120);
        return `| ${escapePipe(v.file)} | ${v.line} | ${v.rule} | ${v.impact} | ${msg} |`;
    });
    return [header, sep, ...rows].join('\n');
}

function formatSource(data: LintReportData): string {
    const version = data.version ? ` v${data.version}` : '';
    const ts = formatShortTimestamp(data.timestamp);
    return `> Source: saropa_lints${version}, ${data.tier} tier, analyzed ${ts}`;
}

function formatStaleness(timestamp: string): string {
    const ms = Date.parse(timestamp);
    if (isNaN(ms)) { return '> Lint data may be stale. Run `dart run custom_lint` to refresh.'; }
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    const age = days === 1 ? '1 day ago' : `${days} days ago`;
    return `> Lint data may be stale (analyzed ${age}). Run \`dart run custom_lint\` to refresh.`;
}

function formatShortTimestamp(ts: string): string {
    const m = ts.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] + 'Z' : ts;
}

function escapePipe(text: string): string { return text.replace(/\|/g, '\\|'); }
