"use strict";
/** Individual section formatters for bug report markdown generation. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLogContext = formatLogContext;
exports.formatEnvironment = formatEnvironment;
exports.formatDevEnvSection = formatDevEnvSection;
exports.formatSourceCode = formatSourceCode;
exports.formatBlame = formatBlame;
exports.formatGitHistory = formatGitHistory;
exports.formatCodeQualitySection = formatCodeQualitySection;
exports.formatCrossSession = formatCrossSession;
exports.formatProductionImpact = formatProductionImpact;
exports.formatLineRangeHistory = formatLineRangeHistory;
exports.formatAffectedFiles = formatAffectedFiles;
exports.shortName = shortName;
exports.formatCommitTable = formatCommitTable;
exports.formatImports = formatImports;
exports.formatDocMatches = formatDocMatches;
exports.formatSymbolDefs = formatSymbolDefs;
exports.formatExecutiveSummary = formatExecutiveSummary;
exports.extractSectionData = extractSectionData;
exports.escapePipe = escapePipe;
exports.formatFooter = formatFooter;
exports.makeGitCtx = makeGitCtx;
exports.formatCommitHash = formatCommitHash;
const analysis_relevance_1 = require("../analysis/analysis-relevance");
const stack_parser_1 = require("../analysis/stack-parser");
const bug_report_owasp_section_1 = require("./bug-report-owasp-section");
const link_helpers_1 = require("../source/link-helpers");
function formatLogContext(context) {
    if (context.length === 0) {
        return '## Log Context\n\n*No preceding log lines.*';
    }
    const block = context.map(l => l.trimEnd()).join('\n');
    return `## Log Context (${context.length} lines before error)\n\n\`\`\`\n${block}\n\`\`\``;
}
function formatEnvironment(env) {
    const keys = Object.keys(env);
    if (keys.length === 0) {
        return '## Environment\n\n*No environment data available.*';
    }
    const rows = keys.map(k => `| ${k} | ${env[k]} |`);
    return `## Environment\n\n| Field | Value |\n|-------|-------|\n${rows.join('\n')}`;
}
function formatDevEnvSection(env) {
    const keys = Object.keys(env);
    if (keys.length === 0) {
        return '## Development Environment\n\n*No dev environment data available.*';
    }
    const rows = keys.map(k => `| ${k} | ${env[k]} |`);
    return `## Development Environment\n\n| Field | Value |\n|-------|-------|\n${rows.join('\n')}`;
}
function formatSourceCode(preview) {
    const lines = preview.lines.map(l => {
        const marker = l.num === preview.targetLine ? '-->' : '   ';
        return `${marker} ${String(l.num).padStart(4)} | ${l.text}`;
    });
    return `## Source Code\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
}
function formatBlame(blame, ctx) {
    const hash = formatCommitHash(blame.hash, ctx);
    return `## Git Blame\n\nLast changed by **${blame.author}** on ${blame.date} · ${hash} ${blame.message}`;
}
function formatGitHistory(commits, ctx) {
    return formatCommitTable('## Recent Git History', commits, ctx);
}
function formatCodeQualitySection(entries) {
    if (entries.length === 0) {
        return '';
    }
    const rows = entries.map(e => {
        const cov = e.linePercent === undefined ? '—' : `${e.linePercent}%`;
        return `| \`${escapePipe(e.filePath)}\` | ${cov} | ${e.lintWarnings} | ${e.lintErrors} |`;
    });
    return [
        '## Code Quality (referenced files)',
        'Files in the stack trace with low coverage (<80%) or lint issues.',
        '',
        '| File | Line coverage | Warnings | Errors |',
        '|------|---------------|----------|--------|',
        ...rows,
    ].join('\n');
}
function formatCrossSession(match) {
    const sessions = match.sessionCount === 1 ? '1 session' : `${match.sessionCount} sessions`;
    const total = match.totalOccurrences === 1 ? '1 occurrence' : `${match.totalOccurrences} occurrences`;
    return [
        '## Cross-Session History',
        `This error has been seen in **${sessions}** with **${total}**.`,
        `- First seen: ${match.firstSeen}`,
        `- Last seen: ${match.lastSeen}`,
    ].join('\n');
}
function formatProductionImpact(fb) {
    const lines = [
        '## Production Impact (Firebase Crashlytics)',
        `- **Issue:** ${fb.issueTitle}`,
        `- **Events:** ${fb.eventCount}`,
        `- **Users affected:** ${fb.userCount}`,
    ];
    if (fb.firstVersion && fb.lastVersion && fb.firstVersion !== fb.lastVersion) {
        lines.push(`- **Versions:** ${fb.firstVersion} → ${fb.lastVersion}`);
    }
    else if (fb.firstVersion) {
        lines.push(`- **Version:** ${fb.firstVersion}`);
    }
    if (fb.consoleUrl) {
        lines.push(`- **Console:** [View in Firebase](${fb.consoleUrl})`);
    }
    return lines.join('\n');
}
function formatLineRangeHistory(commits, ctx) {
    return formatCommitTable('## Recent Changes Near Error', commits, ctx);
}
function formatAffectedFiles(analyses, ctx) {
    if (analyses.length === 0) {
        return [];
    }
    const parts = analyses.map(fa => formatOneFileAnalysis(fa, ctx));
    return [`## Affected Files (${analyses.length})\n\n${parts.join('\n\n---\n\n')}`];
}
function shortName(filePath) { return filePath.split(/[\\/]/).pop() ?? filePath; }
function formatOneFileAnalysis(fa, ctx) {
    const name = shortName(fa.filePath);
    const gitCtx = makeGitCtx(ctx, fa.filePath);
    const heading = (0, link_helpers_1.buildMarkdownFileLink)(name, fa.uri.fsPath, { line: fa.frameLines[0], gitContext: gitCtx });
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
function formatCommitTable(heading, commits, ctx) {
    const rows = commits.map(c => `| ${formatCommitHash(c.hash, ctx)} | ${c.date} | ${escapePipe(c.message)} |`);
    return [heading, '| Hash | Date | Message |\n|------|------|---------|\n' + rows.join('\n')].join('\n\n');
}
function formatImports(results) {
    if (results.imports.length === 0) {
        return '## Dependencies\n\n*No imports detected.*';
    }
    const local = results.imports.filter(i => i.isLocal).map(i => `- \`${i.module}\` (L${i.line})`);
    const pkg = results.imports.filter(i => !i.isLocal).map(i => `- \`${i.module}\` (L${i.line})`);
    let md = `## Dependencies (${results.language})\n\n`;
    if (local.length > 0) {
        md += `**Local** (${local.length}):\n${local.join('\n')}\n\n`;
    }
    if (pkg.length > 0) {
        md += `**Packages** (${pkg.length}):\n${pkg.join('\n')}`;
    }
    return md.trimEnd();
}
function formatDocMatches(results) {
    const hasHeading = results.matches.some(m => m.heading);
    const rows = results.matches.map(m => {
        const loc = `[${m.filename}:${m.lineNumber}](${(0, link_helpers_1.buildVscodeFileUri)(m.uri.fsPath, m.lineNumber)})`;
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
function formatSymbolDefs(results) {
    const rows = results.symbols.map(s => {
        const file = shortName(s.uri.fsPath);
        const loc = `[${file}:${s.line}](${(0, link_helpers_1.buildVscodeFileUri)(s.uri.fsPath, s.line)})`;
        return `| ${s.kind} | ${escapePipe(s.name)} | ${loc} | ${escapePipe(s.containerName)} |`;
    });
    return [
        '## Symbol Definitions',
        '| Kind | Name | Location | Container |\n|------|------|----------|-----------|\n' + rows.join('\n'),
    ].join('\n\n');
}
function formatExecutiveSummary(data) {
    const sectionData = extractSectionData(data);
    const { findings } = (0, analysis_relevance_1.scoreRelevance)(sectionData);
    // Optional: if the crash file has critical/high OWASP violations, make that explicit.
    const crashFile = data.primarySourcePath;
    const owaspCriticalHighInCrash = crashFile
        ? (data.lintMatches?.matches ?? []).filter(v => v.file === crashFile &&
            (v.impact === 'critical' || v.impact === 'high') &&
            (v.owasp.mobile.length > 0 || v.owasp.web.length > 0)).length
        : 0;
    const adjustedFindings = owaspCriticalHighInCrash > 0
        ? findings.map(f => f.sectionId === 'owasp'
            ? {
                ...f,
                text: `${owaspCriticalHighInCrash} critical/high OWASP-mapped violation${owaspCriticalHighInCrash === 1 ? '' : 's'} in crash file`,
            }
            : f)
        : findings;
    const bullets = adjustedFindings.filter(f => f.text && (f.level === 'high' || f.level === 'medium'));
    if (bullets.length === 0) {
        return undefined;
    }
    const lines = bullets.map(f => `- ${f.icon} ${f.text}`);
    return `## Key Findings\n\n${lines.join('\n')}`;
}
function extractSectionData(data) {
    return {
        blame: data.blame ? { date: data.blame.date, author: data.blame.author, hash: data.blame.hash } : undefined,
        lineCommits: data.lineRangeHistory.map(c => ({ date: c.date })),
        annotations: [],
        crossSession: data.crossSessionMatch ? { sessionCount: data.crossSessionMatch.sessionCount, totalOccurrences: data.crossSessionMatch.totalOccurrences, firstSeenDate: (0, stack_parser_1.extractDateFromFilename)(data.crossSessionMatch.firstSeen) } : undefined,
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
        ...(0, bug_report_owasp_section_1.countOwaspCategories)(data.lintMatches?.matches ?? []),
    };
}
function escapePipe(text) { return text.replaceAll('|', String.raw `\|`); }
function formatFooter(filename, lineNumber) {
    const origin = filename
        ? `Report generated from \`${filename}\` at line ${lineNumber}`
        : 'Report generated from collection context';
    return [
        '---',
        `*${origin}*`,
        `**[Saropa Lints](https://pub.dev/packages/saropa_lints/changelog)** — Catch memory leaks, security vulnerabilities, and runtime crashes that standard linters miss. Developed by [Saropa](https://saropa.com/about) to make the world of Dart & Flutter better.`,
    ].join('\n\n');
}
function makeGitCtx(ctx, filePath) {
    if (!ctx.remote || !ctx.branch) {
        return undefined;
    }
    return { remoteUrl: ctx.remote, branch: ctx.branch, relativePath: filePath };
}
function formatCommitHash(hash, ctx) {
    if (!ctx.remote) {
        return `\`${hash}\``;
    }
    const url = (0, link_helpers_1.buildGitHubCommitUrl)(ctx.remote, hash);
    return url ? `[\`${hash}\`](${url})` : `\`${hash}\``;
}
//# sourceMappingURL=bug-report-sections.js.map