/**
 * Render a {@link ThreeWayResult} as a readonly Markdown report (plan 031 MVP presentation).
 *
 * A Markdown document — opened in VS Code's normal preview — is the lightweight surface for the
 * 3-way comparison: it needs no webview, renders the triage summary first (new/resolved errors),
 * then the per-presence line buckets. The richer linked-scroll 3-column viewer is the later step.
 * Pure so it is unit-testable.
 */

import type { Presence, ThreeWayResult } from './session-compare';

/** Cap lines listed per bucket so a huge log doesn't produce a multi-megabyte document. */
const MAX_LINES_PER_BUCKET = 50;

function fence(lines: readonly string[]): string {
    if (lines.length === 0) { return '_(none)_\n'; }
    const shown = lines.slice(0, MAX_LINES_PER_BUCKET);
    const more = lines.length > MAX_LINES_PER_BUCKET
        ? `\n… and ${lines.length - MAX_LINES_PER_BUCKET} more`
        : '';
    return '```\n' + shown.join('\n') + more + '\n```\n';
}

/** Human label for each presence bucket, parameterized by the three session labels. */
function bucketTitle(p: Presence, a: string, b: string, c: string): string {
    switch (p) {
        case 'A': return `Only in ${a}`;
        case 'B': return `Only in ${b}`;
        case 'C': return `Only in ${c}`;
        case 'AB': return `In ${a} + ${b} (not ${c})`;
        case 'AC': return `In ${a} + ${c} (not ${b})`;
        case 'BC': return `In ${b} + ${c} (not ${a})`;
        case 'ABC': return 'In all three';
    }
}

/** Build the full Markdown report. */
export function renderThreeWayMarkdown(result: ThreeWayResult): string {
    const { a, b, c } = result.labels;
    const s = result.summary;
    let md = `# 3-way session comparison\n\n`;
    md += `- **A (baseline):** ${a}\n- **B:** ${b}\n- **C:** ${c}\n\n`;

    md += `## Triage summary\n\n`;
    md += `| Metric | Count |\n| --- | --- |\n`;
    md += `| New errors in B vs baseline | ${s.newErrorsB.length} |\n`;
    md += `| New errors in C vs baseline | ${s.newErrorsC.length} |\n`;
    md += `| Errors resolved vs baseline | ${s.resolvedErrors.length} |\n`;
    md += `| Lines in all three | ${s.counts.ABC} |\n\n`;

    md += `### ⚠ New errors in B (${s.newErrorsB.length})\n\n${fence(s.newErrorsB)}\n`;
    md += `### ⚠ New errors in C (${s.newErrorsC.length})\n\n${fence(s.newErrorsC)}\n`;
    md += `### ✓ Errors resolved vs baseline (${s.resolvedErrors.length})\n\n${fence(s.resolvedErrors)}\n`;

    md += `## Line presence\n\n`;
    const order: Presence[] = ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'];
    for (const p of order) {
        const lines = result.buckets[p];
        md += `### ${bucketTitle(p, a, b, c)} (${lines.length})\n\n${fence(lines)}\n`;
    }
    return md;
}
