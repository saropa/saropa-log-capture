/**
 * Bug report markdown formatter.
 *
 * Formats collected BugReportData into a structured markdown string
 * suitable for pasting into GitHub Issues, StackOverflow, or Slack.
 */

import type { BugReportData, StackFrame, CollectionContext } from './bug-report-collector';
import type { LintReportData } from '../misc/lint-violation-reader';
import { getConfig } from '../config/config';
import { buildMarkdownFileLink } from '../source/link-helpers';
import { buildItemUrl } from '../marketplace-url';
import { formatHealthScoreLine, type HealthScoreParams } from '../misc/health-score';
import { fencedBlock } from '../misc/outbound-content-safety';
import { buildWhyNarrative } from './why-narrative';
import { classifyErrorSemantics } from '../analysis/error-semantics';
import { scoreErrorAttention } from '../analysis/error-attention';
import { formatLintSection } from './bug-report-lint-section';
import { formatOwaspSection } from './bug-report-owasp-section';
import { formatThreadGroupedLines } from './bug-report-thread-format';
import {
    type ReportCtx, shortName,
    formatLogContext, formatEnvironment, formatDevEnvSection, formatSourceCode,
    formatBlame, formatGitHistory, formatCodeQualitySection, formatSecuritySection, formatCrossSession, formatProductionImpact,
    formatLineRangeHistory, formatAffectedFiles, formatImports, formatDocMatches,
    formatSymbolDefs, formatExecutiveSummary, formatFooter, makeGitCtx,
} from './bug-report-sections';

/** Format collected data into a complete markdown bug report. */
export function formatBugReport(data: BugReportData): string {
    const ctx = extractReportCtx(data);
    const summary = formatExecutiveSummary(data);
    const why = formatWhyNarrative(data);
    const attention = formatAttention(data);
    const sections = [
        formatHeader(data.lintMatches, data.lintHealthScoreParams),
        formatSources(data, ctx),
        ...(summary ? [summary] : []),
        ...(attention ? [attention] : []),
        ...(why ? [why] : []),
        formatError(data.errorLine, data.fingerprint),
        formatStackTrace(data.stackTrace, ctx),
        ...formatAffectedFiles(data.fileAnalyses, ctx),
        formatLogContext(data.logContext),
        formatEnvironment(data.environment),
        formatDevEnvSection(data.devEnvironment),
    ];
    if (data.sourcePreview) { sections.push(formatSourceCode(data.sourcePreview)); }
    if (data.blame) { sections.push(formatBlame(data.blame, ctx)); }
    if (data.gitHistory.length > 0) { sections.push(formatGitHistory(data.gitHistory, ctx)); }
    if (data.lineRangeHistory.length > 0) { sections.push(formatLineRangeHistory(data.lineRangeHistory, ctx)); }
    if (data.imports) { sections.push(formatImports(data.imports)); }
    if (data.callers?.length) { sections.push(formatCallers(data.callers)); }
    if (data.docMatches?.matches.length) { sections.push(formatDocMatches(data.docMatches)); }
    if (data.resolvedSymbols?.symbols.length) { sections.push(formatSymbolDefs(data.resolvedSymbols)); }
    if (data.lintMatches?.matches.length) {
        const impactLevel = getConfig().lintReportImpactLevel;
        sections.push(formatLintSection(data.lintMatches, impactLevel));
        const owaspSection = formatOwaspSection(data.lintMatches.matches, data.primarySourcePath);
        if (owaspSection) { sections.push(owaspSection); }
    }
    if (data.collectionContext) { sections.push(formatCollectionContext(data.collectionContext)); }
    if (data.qualitySummary?.length) { sections.push(formatCodeQualitySection(data.qualitySummary)); }
    if (data.securitySummary) { sections.push(formatSecuritySection(data.securitySummary)); }
    if (data.crossSessionMatch) { sections.push(formatCrossSession(data.crossSessionMatch)); }
    if (data.firebaseMatch) { sections.push(formatProductionImpact(data.firebaseMatch)); }
    sections.push(formatFooter(data.logFilename, data.lineNumber));
    return sections.join('\n\n');
}

function extractReportCtx(data: BugReportData): ReportCtx {
    return { remote: data.devEnvironment['Git Remote'], branch: data.devEnvironment['Git Branch'] };
}

/** Callers (idea #4): workspace files that import the crashing source file — its reverse deps,
 *  the places a change here ripples to. Each row shows the importing file and the import path. */
function formatCallers(callers: readonly { relativePath: string; module: string }[]): string {
    const rows = callers.map((c) => `- \`${c.relativePath}\` — imports \`${c.module}\``);
    return `## Callers (${callers.length})\n\n${rows.join('\n')}`;
}

/** Attention score (idea #17): rank how actionable this error is from the signals already
 *  collected. Omitted when there are no contributing factors (e.g. no stack trace, no history). */
function formatAttention(data: BugReportData): string {
    const inAppCode = data.stackTrace.some((f) => f.isApp);
    const sessionCount = data.crossSessionMatch?.sessionCount ?? 0;
    const result = scoreErrorAttention({
        inAppCode,
        frameworkOnly: data.stackTrace.length > 0 && !inAppCode,
        recentlyChanged: data.lineRangeHistory.length > 0,
        recurring: sessionCount > 1,
        firstTimeSeen: sessionCount <= 1,
        inDocumentation: (data.docMatches?.matches.length ?? 0) > 0,
    });
    if (result.contributions.length === 0) { return ''; }
    const factors = result.contributions
        .map((c) => `${c.key} (${c.weight > 0 ? '+' : ''}${c.weight})`)
        .join(', ');
    return `## Attention Score\n\n**${result.score}** — ${factors}`;
}

/** "Why did this break?" narrative (idea #18): a prose synthesis of blame + recurrence + churn.
 *  Returns '' when there is too little history to say anything, so the section is omitted. */
function formatWhyNarrative(data: BugReportData): string {
    const body = buildWhyNarrative({
        errorExcerpt: data.errorLine.slice(0, 200),
        blameAuthor: data.blame?.author,
        blameDate: data.blame?.date,
        blameMessage: data.blame?.message,
        blameHashShort: data.blame?.hash?.slice(0, 7),
        sessionCount: data.crossSessionMatch?.sessionCount,
        firstSeen: data.crossSessionMatch?.firstSeen,
        lineRangeChanges: data.lineRangeHistory.length,
    });
    return body ? `## Why this might have broken\n\n${body}` : '';
}

function formatHeader(lintData?: LintReportData, lintHealthScoreParams?: HealthScoreParams): string {
    const url = buildItemUrl('Saropa.saropa-log-capture');
    const parts = [
        `# Bug Report`,
        `**Generated by [Saropa Log Capture](${url})** | ${new Date().toISOString()}`,
    ];
    if (lintData) {
        const scoreLine = formatHealthScoreLine({
            byImpact: lintData.byImpact,
            filesAnalyzed: lintData.filesAnalyzed,
            tier: lintData.tier,
            totalViolations: lintData.totalInExport,
            params: lintHealthScoreParams,
        });
        if (scoreLine) { parts.push(scoreLine); }
    }
    return parts.join('\n\n');
}

function formatSources(data: BugReportData, ctx: ReportCtx): string {
    const items: string[] = [];
    items.push(`- **Log file:** \`${data.logFilename}\` line ${data.lineNumber}`);
    const sourceFiles = collectSourcePaths(data);
    if (sourceFiles.length > 0) {
        const fileLabels = sourceFiles.map(f => '`' + f + '`').join(', ');
        items.push(`- **Source files:** ${fileLabels}`);
    }
    const docFiles = data.docMatches?.matches.map(m => m.filename) ?? [];
    const uniqueDocs = [...new Set(docFiles)];
    if (uniqueDocs.length > 0) {
        const docLabels = uniqueDocs.map(f => '`' + f + '`').join(', ');
        items.push(`- **Documentation:** ${docLabels}`);
    }
    if (ctx.remote) { items.push(`- **Repository:** [${ctx.remote}](${ctx.remote})`); }
    return `## Sources\n\n${items.join('\n')}`;
}

function collectSourcePaths(data: BugReportData): string[] {
    const paths: string[] = [];
    if (data.primarySourcePath) { paths.push(shortName(data.primarySourcePath)); }
    for (const fa of data.fileAnalyses) {
        const name = shortName(fa.filePath);
        if (!paths.includes(name)) { paths.push(name); }
    }
    return paths;
}

function formatCollectionContext(inv: CollectionContext): string {
    const created = new Date(inv.createdAt).toISOString();
    const rows = inv.sources.map(s => {
        const pinned = new Date(s.pinnedAt).toISOString();
        return `| ${s.label} | ${s.type} | ${pinned} |`;
    }).join('\n');
    const table = `| Source | Type | Pinned |\n|--------|------|--------|\n${rows}`;
    const parts = [
        '## Collection Context',
        `**Collection:** ${inv.name}`,
        `**Created:** ${created}`,
        `### Pinned Sources (${inv.sources.length})`,
        table,
    ];
    if (inv.lastSearchQuery) {
        const recentSearchLines = [
            '### Recent Search',
            `Query: \`${inv.lastSearchQuery}\``,
        ];
        if (inv.lastSearchMatchCount !== undefined) {
            recentSearchLines.push(`Matches: ${inv.lastSearchMatchCount}`);
        }
        parts.push(recentSearchLines.join('\n'));
    }
    if (inv.notes?.trim()) {
        parts.push('### Collection Notes\n' + inv.notes.trim());
    }
    return parts.join('\n\n');
}

function formatError(errorLine: string, fingerprint: string): string {
    // fencedBlock so an error line containing a ``` run can't break out of the code block.
    const parts = [`## Error`, fencedBlock(errorLine), `**Fingerprint:** \`${fingerprint}\``];
    // Semantic category (idea #13): meaning-based grouping (network / filesystem / …) beyond the
    // exact-text fingerprint. Omitted when nothing matches, to avoid a noisy "other" label.
    const category = classifyErrorSemantics(errorLine);
    if (category !== 'other') { parts.push(`**Category:** ${category}`); }
    return parts.join('\n\n');
}

function formatStackTrace(frames: readonly StackFrame[], ctx: ReportCtx): string {
    if (frames.length === 0) { return '## Stack Trace\n\n*No stack trace detected.*'; }
    const appCount = frames.filter(f => f.isApp).length;
    const fwCount = frames.length - appCount;
    const lines = formatThreadGroupedLines(frames);
    const parts = [
        '## Stack Trace',
        fencedBlock(lines.join('\n')),
        `${frames.length} frames (${appCount} app, ${fwCount} framework) — \`>>>\` marks app code`,
    ];
    const linked = formatLinkedFrames(frames, ctx);
    if (linked) { parts.push(linked); }
    return parts.join('\n\n');
}

function formatLinkedFrames(frames: readonly StackFrame[], ctx: ReportCtx): string | undefined {
    const appFrames = frames.filter(f => f.isApp && f.sourceRef);
    if (appFrames.length === 0) { return undefined; }
    const items = appFrames.map(f => {
        const ref = f.sourceRef!;
        const gitCtx = makeGitCtx(ctx, ref.filePath);
        // Never put the raw absolute path in the report text — it leaks the user's home dir
        // (e.g. C:\Users\<name>\...) into a report bound for GitHub/Slack. Show the repo-relative
        // path when we have it (same value the clickable [[GIT]] link uses), else just the basename.
        const rel = gitCtx?.relativePath ?? shortName(ref.filePath);
        const display = `${rel}:${ref.line}${ref.col ? ':' + ref.col : ''}`;
        return `- ${buildMarkdownFileLink(display, undefined, { line: ref.line, col: ref.col, gitContext: gitCtx })}`;
    });
    return `**Linked app frames:**\n${items.join('\n')}`;
}
