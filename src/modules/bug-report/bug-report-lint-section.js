"use strict";
/** Markdown formatter for the "Known Lint Issues" bug report section. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLintSection = formatLintSection;
const health_score_1 = require("../misc/health-score");
const bug_report_sections_1 = require("./bug-report-sections");
const ALLOWED_IMPACTS_BY_LEVEL = {
    essential: new Set(['critical', 'high']),
    recommended: new Set(['critical', 'high', 'medium']),
    full: new Set(['critical', 'high', 'medium', 'low', 'opinionated']),
};
function getSectionLabelSuffix(level) {
    switch (level) {
        case 'essential': return ' (critical + high only)';
        case 'recommended': return ' (up to medium)';
        case 'full': return '';
    }
}
/** Filter violations to those at or above the selected impact level. */
function filterByImpactLevel(matches, level) {
    if (level === 'full') {
        return [...matches];
    }
    const allowed = ALLOWED_IMPACTS_BY_LEVEL[level];
    return matches.filter(v => allowed.has(v.impact));
}
/** Format matched lint violations into a markdown section. Optionally filter by impact level and add label. */
function formatLintSection(data, impactLevel = 'full') {
    const filtered = filterByImpactLevel(data.matches, impactLevel);
    const count = filtered.length;
    const noun = count === 1 ? 'violation' : 'violations';
    const heading = `## Known Lint Issues${getSectionLabelSuffix(impactLevel)}`;
    const lines = [heading];
    const breakdown = (0, health_score_1.formatHealthScoreBreakdown)(data.byImpact);
    if (breakdown) {
        lines.push(breakdown);
    }
    lines.push(`${count} lint ${noun} found in files appearing in this stack trace.`, formatTable(filtered), formatSource(data));
    if (data.isStale) {
        lines.push(formatStaleness(data.timestamp, data.hasExtension));
    }
    return lines.join('\n\n');
}
function formatTable(matches) {
    const header = '| File | Line | Rule | Impact | Message | Explain |';
    const sep = '|------|------|------|--------|---------|---------|';
    const rows = matches.map(v => {
        const msg = (0, bug_report_sections_1.escapePipe)(v.message).slice(0, 80);
        const explainHref = buildExplainHref(v);
        return `| ${(0, bug_report_sections_1.escapePipe)(v.file)} | ${v.line} | ${v.rule} | ${v.impact} | ${msg} | [Explain](${explainHref}) |`;
    });
    return [header, sep, ...rows].join('\n');
}
function buildExplainHref(v) {
    // Custom link scheme handled by `bug-report-panel.ts`:
    // - decodes the payload
    // - calls `saropaLints.explainRule` with a violation-like object
    // Keep the payload compact: the payload is embedded into the markdown
    // table as a link href. The long message itself is not stored in the href
    // (it is instead pulled from the table cell by the webview click handler).
    const shortFile = v.file.split(/[\\/]/).pop() ?? v.file;
    const hasOwasp = v.owasp.mobile.length > 0 || v.owasp.web.length > 0;
    const payload = {
        file: shortFile,
        line: v.line,
        rule: v.rule,
        // The extension requires `message` as a string; we overwrite it on click.
        message: '',
        correction: undefined,
        severity: v.severity,
        impact: v.impact,
        owasp: hasOwasp ? v.owasp : undefined,
    };
    return `saropa-lints:explainRule?payload=${encodeURIComponent(JSON.stringify(payload))}`;
}
function formatSource(data) {
    const version = data.version ? ` v${data.version}` : '';
    const ts = formatShortTimestamp(data.timestamp);
    return `> Source: saropa_lints${version}, ${data.tier} tier, analyzed ${ts}`;
}
function formatStaleness(timestamp, hasExtension) {
    const refreshHint = hasExtension
        ? 'Run analysis in Saropa Lints to refresh.'
        : 'Run `dart run custom_lint` to refresh.';
    const ms = Date.parse(timestamp);
    if (Number.isNaN(ms)) {
        return `> Lint data may be stale. ${refreshHint}`;
    }
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    const age = days === 1 ? '1 day ago' : `${days} days ago`;
    return `> Lint data may be stale (analyzed ${age}). ${refreshHint}`;
}
function formatShortTimestamp(ts) {
    const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(ts);
    return m ? m[1] + 'Z' : ts;
}
//# sourceMappingURL=bug-report-lint-section.js.map