/** Individual section formatters for bug report markdown generation. */

import type { BugReportData, CrossSessionMatch, FirebaseMatch, FileAnalysis } from './bug-report-collector';
import type { BlameLine } from '../git/git-blame';
import type { SourceCodePreview, GitCommit } from '../misc/workspace-analyzer';
import type { DocScanResults } from '../misc/docs-scanner';
import type { ImportResults } from '../source/import-extractor';
import type { SymbolResults } from '../source/symbol-resolver';
import { type SectionData, scoreRelevance } from '../analysis/analysis-relevance';
import { extractDateFromFilename } from '../analysis/stack-parser';
import { countOwaspCategories } from './bug-report-owasp-section';
import { buildVscodeFileUri, buildGitHubCommitUrl, buildMarkdownFileLink, type GitLinkContext } from '../source/link-helpers';

export interface ReportCtx {
    readonly remote?: string;
    readonly branch?: string;
}

export function formatLogContext(context: readonly string[]): string {
    if (context.length === 0) { return '## Log Context\n\n*No preceding log lines.*'; }
    const block = context.map(l => l.trimEnd()).join('\n');
    return `## Log Context (${context.length} lines before error)\n\n\`\`\`\n${block}\n\`\`\``;
}

export function formatEnvironment(env: Record<string, string>): string {
    const keys = Object.keys(env);
    if (keys.length === 0) { return '## Environment\n\n*No environment data available.*'; }
    const rows = keys.map(k => `| ${k} | ${env[k]} |`);
    return `## Environment\n\n| Field | Value |\n|-------|-------|\n${rows.join('\n')}`;
}

export function formatDevEnvSection(env: Record<string, string>): string {
    const keys = Object.keys(env);
    if (keys.length === 0) { return '## Development Environment\n\n*No dev environment data available.*'; }
    const rows = keys.map(k => `| ${k} | ${env[k]} |`);
    return `## Development Environment\n\n| Field | Value |\n|-------|-------|\n${rows.join('\n')}`;
}

export function formatSourceCode(preview: SourceCodePreview): string {
    const lines = preview.lines.map(l => {
        const marker = l.num === preview.targetLine ? '-->' : '   ';
        return `${marker} ${String(l.num).padStart(4)} | ${l.text}`;
    });
    return `## Source Code\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

export function formatBlame(blame: BlameLine, ctx: ReportCtx): string {
    const hash = formatCommitHash(blame.hash, ctx);
    return `## Git Blame\n\nLast changed by **${blame.author}** on ${blame.date} · ${hash} ${blame.message}`;
}

export function formatGitHistory(commits: readonly GitCommit[], ctx: ReportCtx): string {
    return formatCommitTable('## Recent Git History', commits, ctx);
}

export function formatCrossSession(match: CrossSessionMatch): string {
    const sessions = match.sessionCount === 1 ? '1 session' : `${match.sessionCount} sessions`;
    const total = match.totalOccurrences === 1 ? '1 occurrence' : `${match.totalOccurrences} occurrences`;
    return [
        '## Cross-Session History',
        `This error has been seen in **${sessions}** with **${total}**.`,
        `- First seen: ${match.firstSeen}`,
        `- Last seen: ${match.lastSeen}`,
    ].join('\n');
}

export function formatProductionImpact(fb: FirebaseMatch): string {
    const lines = [
        '## Production Impact (Firebase Crashlytics)',
        `- **Issue:** ${fb.issueTitle}`,
        `- **Events:** ${fb.eventCount}`,
        `- **Users affected:** ${fb.userCount}`,
    ];
    if (fb.firstVersion && fb.lastVersion && fb.firstVersion !== fb.lastVersion) {
        lines.push(`- **Versions:** ${fb.firstVersion} → ${fb.lastVersion}`);
    } else if (fb.firstVersion) {
        lines.push(`- **Version:** ${fb.firstVersion}`);
    }
    if (fb.consoleUrl) { lines.push(`- **Console:** [View in Firebase](${fb.consoleUrl})`); }
    return lines.join('\n');
}

export function formatLineRangeHistory(commits: readonly GitCommit[], ctx: ReportCtx): string {
    return formatCommitTable('## Recent Changes Near Error', commits, ctx);
}

export function formatAffectedFiles(analyses: readonly FileAnalysis[], ctx: ReportCtx): string[] {
    if (analyses.length === 0) { return []; }
    const parts = analyses.map(fa => formatOneFileAnalysis(fa, ctx));
    return [`## Affected Files (${analyses.length})\n\n${parts.join('\n\n---\n\n')}`];
}

export function shortName(filePath: string): string { return filePath.split(/[\\/]/).pop() ?? filePath; }

function formatOneFileAnalysis(fa: FileAnalysis, ctx: ReportCtx): string {
    const name = shortName(fa.filePath);
    const gitCtx = makeGitCtx(ctx, fa.filePath);
    const heading = buildMarkdownFileLink(name, fa.uri.fsPath, { line: fa.frameLines[0], gitContext: gitCtx });
    const lines = fa.frameLines.map(l => `L${l}`).join(', ');
    let md = `### ${heading}\n\n**Stack trace lines:** ${lines}`;
    if (fa.blame) {
        const hash = formatCommitHash(fa.blame.hash, ctx);
        md += `\n\n**Last changed:** ${fa.blame.author} on ${fa.blame.date} · ${hash} ${fa.blame.message}`;
    }
    if (fa.recentCommits.length > 0) {
        const rows = fa.recentCommits.map(c => `| ${formatCommitHash(c.hash, ctx)} | ${c.date} | ${escapePipe(c.message)} |`);
        md += `\n\n| Hash | Date | Message |\n|------|------|---------|\n${rows.join('\n')}`;
    }
    return md;
}

export function formatCommitTable(heading: string, commits: readonly GitCommit[], ctx: ReportCtx): string {
    const rows = commits.map(c => `| ${formatCommitHash(c.hash, ctx)} | ${c.date} | ${escapePipe(c.message)} |`);
    return [heading, '| Hash | Date | Message |\n|------|------|---------|\n' + rows.join('\n')].join('\n\n');
}

export function formatImports(results: ImportResults): string {
    if (results.imports.length === 0) { return '## Dependencies\n\n*No imports detected.*'; }
    const local = results.imports.filter(i => i.isLocal).map(i => `- \`${i.module}\` (L${i.line})`);
    const pkg = results.imports.filter(i => !i.isLocal).map(i => `- \`${i.module}\` (L${i.line})`);
    let md = `## Dependencies (${results.language})\n\n`;
    if (local.length > 0) { md += `**Local** (${local.length}):\n${local.join('\n')}\n\n`; }
    if (pkg.length > 0) { md += `**Packages** (${pkg.length}):\n${pkg.join('\n')}`; }
    return md.trimEnd();
}

export function formatDocMatches(results: DocScanResults): string {
    const hasHeading = results.matches.some(m => m.heading);
    const rows = results.matches.map(m => {
        const loc = `[${m.filename}:${m.lineNumber}](${buildVscodeFileUri(m.uri.fsPath, m.lineNumber)})`;
        const section = hasHeading ? ` ${escapePipe(m.heading ?? '')} |` : '';
        const context = escapePipe(m.lineText.trim().slice(0, 80));
        return hasHeading
            ? `| ${loc} | ${escapePipe(m.matchedToken)} |${section} ${context} |`
            : `| ${loc} | ${escapePipe(m.matchedToken)} | ${context} |`;
    });
    const header = hasHeading
        ? '| Location | Token | Section | Context |\n|----------|-------|---------|--------|\n'
        : '| Location | Token | Context |\n|----------|-------|---------|\n';
    return [
        `## Related Documentation (${results.matches.length} references)`,
        header + rows.join('\n'),
    ].join('\n\n');
}

export function formatSymbolDefs(results: SymbolResults): string {
    const rows = results.symbols.map(s => {
        const file = shortName(s.uri.fsPath);
        const loc = `[${file}:${s.line}](${buildVscodeFileUri(s.uri.fsPath, s.line)})`;
        return `| ${s.kind} | ${escapePipe(s.name)} | ${loc} | ${escapePipe(s.containerName)} |`;
    });
    return [
        '## Symbol Definitions',
        '| Kind | Name | Location | Container |\n|------|------|----------|-----------|\n' + rows.join('\n'),
    ].join('\n\n');
}

export function formatExecutiveSummary(data: BugReportData): string | undefined {
    const sectionData = extractSectionData(data);
    const { findings } = scoreRelevance(sectionData);
    const bullets = findings.filter(f => f.text && (f.level === 'high' || f.level === 'medium'));
    if (bullets.length === 0) { return undefined; }
    const lines = bullets.map(f => `- ${f.icon} ${f.text}`);
    return `## Key Findings\n\n${lines.join('\n')}`;
}

export function extractSectionData(data: BugReportData): SectionData {
    return {
        blame: data.blame ? { date: data.blame.date, author: data.blame.author, hash: data.blame.hash } : undefined,
        lineCommits: data.lineRangeHistory.map(c => ({ date: c.date })),
        annotations: [],
        crossSession: data.crossSessionMatch ? { sessionCount: data.crossSessionMatch.sessionCount, totalOccurrences: data.crossSessionMatch.totalOccurrences, firstSeenDate: extractDateFromFilename(data.crossSessionMatch.firstSeen) } : undefined,
        docMatchCount: data.docMatches?.matches.length ?? 0,
        symbolCount: data.resolvedSymbols?.symbols.length ?? 0,
        tokenMatchCount: 0,
        tokenFileCount: 0,
        importCount: data.imports?.imports.length ?? 0,
        localImportCount: data.imports?.localCount ?? 0,
        gitCommitCount: data.gitHistory.length,
        affectedFileCount: data.fileAnalyses.length,
        lintViolationCount: data.lintMatches?.matches.length ?? 0,
        lintCriticalCount: data.lintMatches?.matches.filter(v => v.impact === 'critical').length ?? 0,
        ...countOwaspCategories(data.lintMatches?.matches ?? []),
    };
}

export function escapePipe(text: string): string { return text.replace(/\|/g, '\\|'); }

export function formatFooter(filename: string, lineNumber: number): string {
    const origin = filename
        ? `Report generated from \`${filename}\` at line ${lineNumber}`
        : 'Report generated from investigation context';
    return [
        '---',
        `*${origin}*`,
        `**[Saropa Lints](https://pub.dev/packages/saropa_lints/changelog)** — Catch memory leaks, security vulnerabilities, and runtime crashes that standard linters miss. Developed by [Saropa](https://saropa.com/about) to make the world of Dart & Flutter better.`,
    ].join('\n\n');
}

export function makeGitCtx(ctx: ReportCtx, filePath: string): GitLinkContext | undefined {
    if (!ctx.remote || !ctx.branch) { return undefined; }
    return { remoteUrl: ctx.remote, branch: ctx.branch, relativePath: filePath };
}

export function formatCommitHash(hash: string, ctx: ReportCtx): string {
    if (!ctx.remote) { return `\`${hash}\``; }
    const url = buildGitHubCommitUrl(ctx.remote, hash);
    return url ? `[\`${hash}\`](${url})` : `\`${hash}\``;
}
