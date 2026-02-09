/** Relevance scoring for analysis sections — determines what matters most. */

export type RelevanceLevel = 'high' | 'medium' | 'low' | 'none';

/** A finding to display in the executive summary. */
export interface SectionFinding {
    readonly icon: string;
    readonly text: string;
    readonly level: RelevanceLevel;
    readonly sectionId: string;
}

/** Input metrics from each analysis stream. All fields optional. */
export interface SectionData {
    readonly blame?: { readonly date: string; readonly author: string; readonly hash: string };
    readonly lineCommits?: readonly { readonly date: string }[];
    readonly annotations?: readonly { readonly type: string }[];
    readonly crossSession?: { readonly sessionCount: number; readonly totalOccurrences: number; readonly firstSeenDate?: string; readonly trend?: readonly { readonly date: string; readonly count: number }[] };
    readonly docMatchCount?: number;
    readonly symbolCount?: number;
    readonly tokenMatchCount?: number;
    readonly tokenFileCount?: number;
    readonly importCount?: number;
    readonly localImportCount?: number;
    readonly gitCommitCount?: number;
    readonly affectedFileCount?: number;
    readonly relatedLineCount?: number;
    readonly relatedFileCount?: number;
    readonly githubBlamePr?: boolean;
    readonly githubPrCount?: number;
    readonly githubIssueCount?: number;
}

/** Scoring output: summary findings + per-section relevance levels. */
export interface RelevanceResult {
    readonly findings: readonly SectionFinding[];
    readonly sectionLevels: ReadonlyMap<string, RelevanceLevel>;
}

const recentDaysThreshold = 7;

/** Score all section data and produce findings + collapse directives. */
export function scoreRelevance(data: SectionData): RelevanceResult {
    const findings: SectionFinding[] = [];
    const levels = new Map<string, RelevanceLevel>();

    scoreBlame(data, findings, levels);
    scoreLineHistory(data, findings, levels);
    scoreCrossSession(data, findings, levels);
    scoreCorrelation(data, findings);
    scoreRelatedLines(data, findings, levels);
    scoreGitHub(data, findings, levels);
    scoreDocs(data, findings, levels);
    scoreAnnotations(data, findings, levels);
    scoreSymbols(data, levels);
    scoreTokens(data, levels);
    scoreImports(data, levels);
    scoreGitHistory(data, levels);
    scoreAffectedFiles(data, findings);

    findings.sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
    return { findings: findings.slice(0, 4), sectionLevels: levels };
}

function scoreBlame(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    if (!data.blame) { return; }
    const days = daysAgo(data.blame.date);
    if (days <= recentDaysThreshold) {
        findings.push({ icon: '🔴', text: `Crash line changed ${formatDaysAgo(days)} by ${data.blame.author}`, level: 'high', sectionId: 'source' });
        levels.set('source', 'high');
    } else if (!levels.has('source')) {
        levels.set('source', 'medium');
    }
}

function scoreLineHistory(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    if (!data.lineCommits?.length) { levels.set('line-history', levels.get('line-history') ?? 'none'); return; }
    const recent = data.lineCommits.some(c => daysAgo(c.date) <= recentDaysThreshold);
    if (recent) {
        findings.push({ icon: '🔴', text: 'Code near error modified recently', level: 'high', sectionId: 'line-history' });
        levels.set('line-history', 'high');
    } else {
        levels.set('line-history', 'medium');
    }
}

function scoreCrossSession(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    if (!data.crossSession) { return; }
    if (data.crossSession.sessionCount >= 2) {
        findings.push({ icon: '🟡', text: `Seen ${data.crossSession.totalOccurrences} times across ${data.crossSession.sessionCount} sessions`, level: 'high', sectionId: 'tokens' });
    }
}

const correlationWindow = 3;

function scoreCorrelation(data: SectionData, findings: SectionFinding[]): void {
    if (!data.blame || !data.crossSession?.firstSeenDate) { return; }
    const blameDays = daysAgo(data.blame.date);
    const firstSeenDays = daysAgo(data.crossSession.firstSeenDate);
    if (blameDays === Infinity || firstSeenDays === Infinity) { return; }
    const gap = blameDays - firstSeenDays;
    if (gap >= 0 && gap <= correlationWindow) {
        findings.push({ icon: '🔴', text: `Error likely introduced by commit \`${data.blame.hash}\``, level: 'high', sectionId: 'source' });
    } else if (data.crossSession.sessionCount >= 3) {
        findings.push({ icon: '🟡', text: `Error persists across ${data.crossSession.sessionCount} sessions`, level: 'medium', sectionId: 'tokens' });
    }
}

function scoreDocs(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    const count = data.docMatchCount ?? 0;
    if (count > 0) {
        findings.push({ icon: '📚', text: `Referenced in ${count} project doc${count !== 1 ? 's' : ''}`, level: 'high', sectionId: 'docs' });
        levels.set('docs', 'high');
    } else {
        levels.set('docs', 'none');
    }
}

function scoreAnnotations(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    if (!data.annotations?.length) { return; }
    const urgent = data.annotations.filter(a => /^(BUG|FIXME)$/i.test(a.type));
    if (urgent.length > 0) {
        findings.push({ icon: '⚠️', text: `${urgent[0].type} annotation near crash line`, level: 'high', sectionId: 'source' });
        levels.set('source', 'high');
    }
}

function scoreSymbols(data: SectionData, levels: Map<string, RelevanceLevel>): void {
    levels.set('symbols', (data.symbolCount ?? 0) > 0 ? 'medium' : 'none');
}

function scoreTokens(data: SectionData, levels: Map<string, RelevanceLevel>): void {
    const matches = data.tokenMatchCount ?? 0;
    if (matches > 0) { levels.set('tokens', levels.get('tokens') ?? 'medium'); }
    else { levels.set('tokens', levels.get('tokens') ?? 'none'); }
}

function scoreImports(data: SectionData, levels: Map<string, RelevanceLevel>): void {
    levels.set('imports', (data.importCount ?? 0) > 0 ? 'low' : 'none');
}

function scoreGitHistory(data: SectionData, levels: Map<string, RelevanceLevel>): void {
    if (!levels.has('source')) { levels.set('source', (data.gitCommitCount ?? 0) > 0 ? 'low' : 'none'); }
}

function scoreRelatedLines(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    const count = data.relatedLineCount ?? 0;
    if (count >= 10) {
        findings.push({ icon: '📋', text: `Active diagnostic area (${count} related lines)`, level: 'high', sectionId: 'related' });
        levels.set('related', 'high');
    } else if (count > 0) { levels.set('related', 'medium'); }
    const files = data.relatedFileCount ?? 0;
    if (files >= 3) {
        findings.push({ icon: '📁', text: `Spans ${files} source files`, level: 'medium', sectionId: 'files' });
        levels.set('files', 'medium');
    } else { levels.set('files', files > 0 ? 'low' : 'none'); }
}

function scoreGitHub(data: SectionData, findings: SectionFinding[], levels: Map<string, RelevanceLevel>): void {
    if (data.githubBlamePr) {
        findings.push({ icon: '🔴', text: 'PR identified that likely introduced this error', level: 'high', sectionId: 'github' });
        levels.set('github', 'high');
    } else if ((data.githubIssueCount ?? 0) > 0) {
        findings.push({ icon: '🟡', text: `${data.githubIssueCount} open issue${data.githubIssueCount !== 1 ? 's' : ''} match this error`, level: 'high', sectionId: 'github' });
        levels.set('github', 'high');
    } else if ((data.githubPrCount ?? 0) > 0) {
        levels.set('github', 'medium');
    } else { levels.set('github', 'none'); }
}

function scoreAffectedFiles(data: SectionData, findings: SectionFinding[]): void {
    const count = data.affectedFileCount ?? 0;
    if (count >= 3) {
        findings.push({ icon: '📁', text: `Error spans ${count} source files`, level: 'medium', sectionId: 'affected-files' });
    }
}

/** Parse YYYY-MM-DD and return days since today. Returns Infinity for unparseable dates. */
export function daysAgo(dateStr: string): number {
    const ms = Date.parse(dateStr + 'T00:00:00Z');
    if (isNaN(ms)) { return Infinity; }
    return Math.floor((Date.now() - ms) / 86_400_000);
}

function formatDaysAgo(days: number): string {
    if (days === 0) { return 'today'; }
    if (days === 1) { return 'yesterday'; }
    return `${days} days ago`;
}

function levelOrder(level: RelevanceLevel): number {
    return level === 'high' ? 0 : level === 'medium' ? 1 : level === 'low' ? 2 : 3;
}
