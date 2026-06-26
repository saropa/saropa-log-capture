/**
 * Pure markdown builder for an Investigation overview document (cross-session-analysis idea #2).
 *
 * The overview is what makes a multi-session debugging effort "read as one thing": the named
 * title, the root-cause notes, and the member sessions in order with their error/warning counts
 * and per-session notes. Pure (no vscode/fs) so it is unit-testable and so the same text can feed a
 * saved `.md` file, the clipboard, or a webview preview without change.
 */

import type { Investigation } from './investigation-model';

/** One member session rendered into the overview. */
export interface InvestigationMember {
    /** The investigation's session key (workspace-relative path). */
    readonly key: string;
    /** Display label — the session's displayName or filename. */
    readonly displayName: string;
    /** Optional markdown link target (e.g. a `vscode://file/…` URI) making the row clickable. */
    readonly link?: string;
    /** Cached error-line count, omitted from the row when undefined. */
    readonly errorCount?: number;
    /** Cached warning-line count, omitted from the row when undefined. */
    readonly warningCount?: number;
    /** Per-session free-text note (idea #7), shown after the counts when present. */
    readonly note?: string;
}

/** Pluralize a count as "N thing" / "N things". */
function plural(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** Build the "3 errors, 1 warning" severity fragment, or '' when no counts are known. */
function severityFragment(member: InvestigationMember): string {
    const parts: string[] = [];
    if (member.errorCount !== undefined && member.errorCount > 0) {
        parts.push(plural(member.errorCount, 'error'));
    }
    if (member.warningCount !== undefined && member.warningCount > 0) {
        parts.push(plural(member.warningCount, 'warning'));
    }
    return parts.join(', ');
}

/** Render one numbered member row: name (linked), severity counts, and note. */
function memberLine(member: InvestigationMember, index: number): string {
    const name = member.link ? `[${member.displayName}](${member.link})` : member.displayName;
    const segments = [`**${name}**`];
    const severity = severityFragment(member);
    if (severity) { segments.push(severity); }
    if (member.note) { segments.push(`_${member.note}_`); }
    return `${index + 1}. ${segments.join(' — ')}`;
}

/**
 * Build the full overview markdown for an investigation and its resolved members.
 * Members are rendered in the order given (callers pass them in the investigation's key order).
 */
export function buildInvestigationOverview(
    inv: Investigation,
    members: readonly InvestigationMember[],
): string {
    const blocks: string[] = [`# Investigation: ${inv.title}`];
    blocks.push(inv.notes.trim() ? inv.notes.trim() : '*No notes yet.*');
    blocks.push(`## Sessions (${members.length})`);
    if (members.length === 0) {
        blocks.push('*No sessions added yet.*');
    } else {
        blocks.push(members.map((m, i) => memberLine(m, i)).join('\n'));
    }
    return blocks.join('\n\n') + '\n';
}
