"use strict";
/** Relevance scoring for analysis sections — determines what matters most. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreRelevance = scoreRelevance;
exports.daysAgo = daysAgo;
const recentDaysThreshold = 7;
/** Score all section data and produce findings + collapse directives. */
function scoreRelevance(data) {
    const findings = [];
    const levels = new Map();
    scoreBlame(data, findings, levels);
    scoreLineHistory(data, findings, levels);
    scoreCrossSession(data, findings, levels);
    scoreCorrelation(data, findings);
    scoreRelatedLines(data, findings, levels);
    scoreGitHub(data, findings, levels);
    scoreFirebase(data, findings, levels);
    scoreDocs(data, findings, levels);
    scoreAnnotations(data, findings, levels);
    scoreSymbols(data, levels);
    scoreTokens(data, levels);
    scoreImports(data, levels);
    scoreGitHistory(data, levels);
    scoreAffectedFiles(data, findings);
    scoreLint(data, findings, levels);
    scoreOwasp(data, findings, levels);
    findings.sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
    return { findings: findings.slice(0, 4), sectionLevels: levels };
}
function scoreBlame(data, findings, levels) {
    if (!data.blame) {
        return;
    }
    const days = daysAgo(data.blame.date);
    if (days <= recentDaysThreshold) {
        findings.push({ icon: '🔴', text: `Crash line changed ${formatDaysAgo(days)} by ${data.blame.author}`, level: 'high', sectionId: 'source' });
        levels.set('source', 'high');
    }
    else if (!levels.has('source')) {
        levels.set('source', 'medium');
    }
}
function scoreLineHistory(data, findings, levels) {
    if (!data.lineCommits?.length) {
        levels.set('line-history', levels.get('line-history') ?? 'none');
        return;
    }
    const recent = data.lineCommits.some(c => daysAgo(c.date) <= recentDaysThreshold);
    if (recent) {
        findings.push({ icon: '🔴', text: 'Code near error modified recently', level: 'high', sectionId: 'line-history' });
        levels.set('line-history', 'high');
    }
    else {
        levels.set('line-history', 'medium');
    }
}
function scoreCrossSession(data, findings, _levels) {
    if (!data.crossSession) {
        return;
    }
    if (data.crossSession.sessionCount >= 2) {
        findings.push({ icon: '🟡', text: `Seen ${data.crossSession.totalOccurrences} times across ${data.crossSession.sessionCount} sessions`, level: 'high', sectionId: 'tokens' });
    }
}
const correlationWindow = 3;
function scoreCorrelation(data, findings) {
    if (!data.blame || !data.crossSession?.firstSeenDate) {
        return;
    }
    const blameDays = daysAgo(data.blame.date);
    const firstSeenDays = daysAgo(data.crossSession.firstSeenDate);
    if (blameDays === Infinity || firstSeenDays === Infinity) {
        return;
    }
    const gap = blameDays - firstSeenDays;
    if (gap >= 0 && gap <= correlationWindow) {
        findings.push({ icon: '🔴', text: `Error likely introduced by commit \`${data.blame.hash}\``, level: 'high', sectionId: 'source' });
    }
    else if (data.crossSession.sessionCount >= 3) {
        findings.push({ icon: '🟡', text: `Error persists across ${data.crossSession.sessionCount} sessions`, level: 'medium', sectionId: 'tokens' });
    }
}
function scoreDocs(data, findings, levels) {
    const count = data.docMatchCount ?? 0;
    if (count > 0) {
        findings.push({ icon: '📚', text: `Referenced in ${count} project doc${count !== 1 ? 's' : ''}`, level: 'high', sectionId: 'docs' });
        levels.set('docs', 'high');
    }
    else {
        levels.set('docs', 'none');
    }
}
function scoreAnnotations(data, findings, levels) {
    if (!data.annotations?.length) {
        return;
    }
    const urgent = data.annotations.filter(a => /^(BUG|FIXME)$/i.test(a.type));
    if (urgent.length > 0) {
        findings.push({ icon: '⚠️', text: `${urgent[0].type} annotation near crash line`, level: 'high', sectionId: 'source' });
        levels.set('source', 'high');
    }
}
function scoreSymbols(data, levels) {
    levels.set('symbols', (data.symbolCount ?? 0) > 0 ? 'medium' : 'none');
}
function scoreTokens(data, levels) {
    const matches = data.tokenMatchCount ?? 0;
    if (matches > 0) {
        levels.set('tokens', levels.get('tokens') ?? 'medium');
    }
    else {
        levels.set('tokens', levels.get('tokens') ?? 'none');
    }
}
function scoreImports(data, levels) {
    levels.set('imports', (data.importCount ?? 0) > 0 ? 'low' : 'none');
}
function scoreGitHistory(data, levels) {
    if (!levels.has('source')) {
        levels.set('source', (data.gitCommitCount ?? 0) > 0 ? 'low' : 'none');
    }
}
function scoreRelatedLines(data, findings, levels) {
    const count = data.relatedLineCount ?? 0;
    if (count >= 10) {
        findings.push({ icon: '📋', text: `Active diagnostic area (${count} related lines)`, level: 'high', sectionId: 'related' });
        levels.set('related', 'high');
    }
    else if (count > 0) {
        levels.set('related', 'medium');
    }
    const files = data.relatedFileCount ?? 0;
    if (files >= 3) {
        findings.push({ icon: '📁', text: `Spans ${files} source files`, level: 'medium', sectionId: 'files' });
        levels.set('files', 'medium');
    }
    else {
        levels.set('files', files > 0 ? 'low' : 'none');
    }
}
function scoreGitHub(data, findings, levels) {
    if (data.githubBlamePr) {
        findings.push({ icon: '🔴', text: 'PR identified that likely introduced this error', level: 'high', sectionId: 'github' });
        levels.set('github', 'high');
    }
    else if ((data.githubIssueCount ?? 0) > 0) {
        findings.push({ icon: '🟡', text: `${data.githubIssueCount} open issue${data.githubIssueCount !== 1 ? 's' : ''} match this error`, level: 'high', sectionId: 'github' });
        levels.set('github', 'high');
    }
    else if ((data.githubPrCount ?? 0) > 0) {
        levels.set('github', 'medium');
    }
    else {
        levels.set('github', 'none');
    }
}
function scoreFirebase(data, findings, levels) {
    const count = data.crashlyticsIssueCount ?? 0;
    if (count > 0 && data.productionImpact) {
        const { eventCount, userCount } = data.productionImpact;
        findings.push({ icon: '🔥', text: `Also in production: ${eventCount} events, ${userCount} users`, level: 'high', sectionId: 'firebase' });
        levels.set('firebase', 'high');
    }
    else if (count > 0) {
        findings.push({ icon: '🔥', text: `${count} matching Crashlytics issue${count !== 1 ? 's' : ''} in production`, level: 'high', sectionId: 'firebase' });
        levels.set('firebase', 'high');
    }
    else {
        levels.set('firebase', 'none');
    }
}
function scoreAffectedFiles(data, findings) {
    const count = data.affectedFileCount ?? 0;
    if (count >= 3) {
        findings.push({ icon: '📁', text: `Error spans ${count} source files`, level: 'medium', sectionId: 'affected-files' });
    }
}
function scoreLint(data, findings, levels) {
    const count = data.lintViolationCount ?? 0;
    const critical = data.lintCriticalCount ?? 0;
    if (critical > 0) {
        findings.push({ icon: '🔴', text: `${critical} critical lint violation${critical !== 1 ? 's' : ''} in stack trace files`, level: 'high', sectionId: 'lint' });
        levels.set('lint', 'high');
    }
    else if (count > 0) {
        findings.push({ icon: '⚠️', text: `${count} lint violation${count !== 1 ? 's' : ''} in stack trace files`, level: 'medium', sectionId: 'lint' });
        levels.set('lint', 'medium');
    }
    else {
        levels.set('lint', 'none');
    }
}
function scoreOwasp(data, findings, levels) {
    const count = data.owaspViolationCount ?? 0;
    if (count === 0) {
        return;
    }
    const cats = data.owaspCategories ? ` (${data.owaspCategories})` : '';
    findings.push({
        icon: '🛡️', text: `${count} OWASP-mapped violation${count !== 1 ? 's' : ''} in stack trace files${cats}`,
        level: 'high', sectionId: 'owasp',
    });
    levels.set('owasp', 'high');
}
/** Parse YYYY-MM-DD and return days since today. Returns Infinity for unparseable dates. */
function daysAgo(dateStr) {
    const ms = Date.parse(dateStr + 'T00:00:00Z');
    if (isNaN(ms)) {
        return Infinity;
    }
    return Math.floor((Date.now() - ms) / 86_400_000);
}
function formatDaysAgo(days) {
    if (days === 0) {
        return 'today';
    }
    if (days === 1) {
        return 'yesterday';
    }
    return `${days} days ago`;
}
function levelOrder(level) {
    return level === 'high' ? 0 : level === 'medium' ? 1 : level === 'low' ? 2 : 3;
}
//# sourceMappingURL=analysis-relevance.js.map