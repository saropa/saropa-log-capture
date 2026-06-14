/**
 * "Why did this break?" narrative (cross-session-analysis idea #18).
 *
 * Weaves the structured signals a bug report already collects — git blame on the crash line,
 * recent commits to the surrounding code, and cross-session frequency — into a few plain-English
 * sentences plus a suggested next step. Template hypotheses (root-cause-hints) answer "what kind of
 * failure is this"; this answers "what is the story behind this specific line".
 *
 * Pure (no vscode import) and English-only by design: it feeds the markdown bug report, which stays
 * English for pasting into GitHub/Slack (same policy as the rest of the export). Returns '' when
 * there are too few facts to say anything non-obvious, so the report omits the section entirely.
 */

/** Structured facts the narrative is built from. All optional except the error excerpt. */
export interface WhyNarrativeFacts {
    /** Short excerpt of the error line (already truncated by the caller). */
    readonly errorExcerpt: string;
    /** Git blame on the crash line, if the line is committed. */
    readonly blameAuthor?: string;
    readonly blameDate?: string;
    readonly blameMessage?: string;
    readonly blameHashShort?: string;
    /** How many sessions this error fingerprint has appeared in (1 = only this one). */
    readonly sessionCount?: number;
    /** Filename of the earliest session the error was seen in. */
    readonly firstSeen?: string;
    /** Recent commits touching the ±line region around the crash. */
    readonly lineRangeChanges?: number;
}

/** True once at least one correlating fact (blame or recurrence) exists to narrate. */
function hasStory(f: WhyNarrativeFacts): boolean {
    return Boolean(f.blameAuthor) || (f.sessionCount ?? 0) > 1 || (f.lineRangeChanges ?? 0) > 0;
}

/** Sentence about who last changed the crash line and in what commit. */
function blameSentence(f: WhyNarrativeFacts): string | undefined {
    if (!f.blameAuthor) { return undefined; }
    const commit = f.blameHashShort ? ` (commit \`${f.blameHashShort}\`` : '';
    const msg = f.blameMessage ? `: "${f.blameMessage}"` : '';
    const close = commit ? `${msg})` : msg;
    const when = f.blameDate ? ` on ${f.blameDate}` : '';
    return `The crash line was last changed by ${f.blameAuthor}${when}${commit}${close}.`;
}

/** Sentence about how often the error recurs across sessions. */
function recurrenceSentence(f: WhyNarrativeFacts): string | undefined {
    const n = f.sessionCount ?? 0;
    if (n > 1) {
        const seen = f.firstSeen ? `, first seen in \`${f.firstSeen}\`` : '';
        return `This error has appeared in ${n} sessions${seen}.`;
    }
    if (n === 1) { return 'This error appears only in the current session so far.'; }
    return undefined;
}

/** Sentence about recent churn in the surrounding code. */
function churnSentence(f: WhyNarrativeFacts): string | undefined {
    const c = f.lineRangeChanges ?? 0;
    if (c <= 0) { return undefined; }
    return `The surrounding code changed in ${c} recent commit${c === 1 ? '' : 's'}.`;
}

/** A suggested next step keyed to the strongest available signal. */
function suggestion(f: WhyNarrativeFacts): string {
    const recentlyChanged = (f.lineRangeChanges ?? 0) > 0 || Boolean(f.blameHashShort);
    const recurring = (f.sessionCount ?? 0) > 1;
    if (recentlyChanged && recurring) {
        return 'Review the recent commits to this code — a regression that keeps recurring usually traces to the last change here.';
    }
    if (recentlyChanged) {
        return 'Start with the most recent commit to this line; the change and the error are close in time.';
    }
    if (recurring) {
        return 'The code here has been stable, so look outward — inputs, dependencies, or environment that changed between sessions.';
    }
    return 'Too little history to point at a cause; capture another session to see whether this recurs.';
}

/**
 * Build the narrative as a markdown section body, or '' when there is nothing worth narrating.
 * Each available fact becomes one sentence; a suggested-investigation line always closes it.
 */
export function buildWhyNarrative(facts: WhyNarrativeFacts): string {
    if (!hasStory(facts)) { return ''; }
    const sentences = [
        blameSentence(facts),
        recurrenceSentence(facts),
        churnSentence(facts),
    ].filter((s): s is string => Boolean(s));
    const body = sentences.join(' ');
    return `${body}\n\n**Suggested investigation:** ${suggestion(facts)}`;
}
