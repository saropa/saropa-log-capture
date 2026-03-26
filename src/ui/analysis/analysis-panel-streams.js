"use strict";
/** Stream functions for the analysis panel — each runs one async analysis pipeline. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSourceChain = runSourceChain;
exports.runDocsScan = runDocsScan;
exports.runSymbolResolution = runSymbolResolution;
exports.runTokenSearch = runTokenSearch;
exports.runCrossSessionLookup = runCrossSessionLookup;
exports.runReferencedFiles = runReferencedFiles;
exports.runGitHubLookup = runGitHubLookup;
exports.runFirebaseLookup = runFirebaseLookup;
const vscode = __importStar(require("vscode"));
const source_linker_1 = require("../../modules/source/source-linker");
const workspace_analyzer_1 = require("../../modules/misc/workspace-analyzer");
const git_blame_1 = require("../../modules/git/git-blame");
const git_diff_1 = require("../../modules/git/git-diff");
const git_source_code_1 = require("../../modules/integrations/providers/git-source-code");
const config_1 = require("../../modules/config/config");
const docs_scanner_1 = require("../../modules/misc/docs-scanner");
const import_extractor_1 = require("../../modules/source/import-extractor");
const symbol_resolver_1 = require("../../modules/source/symbol-resolver");
const error_fingerprint_1 = require("../../modules/analysis/error-fingerprint");
const cross_session_aggregator_1 = require("../../modules/misc/cross-session-aggregator");
const stack_parser_1 = require("../../modules/analysis/stack-parser");
const log_search_1 = require("../../modules/search/log-search");
const github_context_1 = require("../../modules/git/github-context");
const analysis_related_render_1 = require("./analysis-related-render");
const firebase_crashlytics_1 = require("../../modules/crashlytics/firebase-crashlytics");
const analysis_panel_helpers_1 = require("./analysis-panel-helpers");
const analysis_panel_render_1 = require("./analysis-panel-render");
async function runSourceChain(ctx, filename, crashLine) {
    const { post, signal, progress } = ctx;
    if (!filename) {
        (0, analysis_panel_helpers_1.postNoSource)(post, '📄 No source file reference found');
        return {};
    }
    const wsInfo = await (0, workspace_analyzer_1.analyzeSourceFile)(filename, crashLine);
    if (signal.aborted) {
        return {};
    }
    if (!wsInfo) {
        (0, analysis_panel_helpers_1.postNoSource)(post, '📄 Source file not found in workspace');
        return {};
    }
    progress('source', '📄 Running git blame...');
    const blame = wsInfo.uri && crashLine
        ? await (0, git_blame_1.getGitBlame)(wsInfo.uri, crashLine).catch(() => undefined)
        : undefined;
    if (signal.aborted) {
        return {};
    }
    const diff = blame ? await (0, git_diff_1.getCommitDiff)(blame.hash).catch(() => undefined) : undefined;
    if (signal.aborted) {
        return {};
    }
    let blameCommitUrl;
    if (blame && (0, config_1.getConfig)().integrationsGit?.commitLinks) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (cwd) {
            blameCommitUrl = await (0, git_source_code_1.getCommitUrl)(cwd, blame.hash).catch(() => undefined);
        }
    }
    post('source', (0, analysis_panel_render_1.renderSourceSection)(wsInfo, blame, diff, blameCommitUrl));
    post('line-history', (0, analysis_panel_render_1.renderLineHistorySection)(wsInfo.lineCommits));
    const metrics = (0, analysis_panel_helpers_1.buildSourceMetrics)(wsInfo, blame);
    try {
        progress('imports', '📦 Parsing imports...');
        const imports = await (0, import_extractor_1.extractImports)(wsInfo.uri);
        if (!signal.aborted) {
            post('imports', (0, analysis_panel_render_1.renderImportsSection)(imports));
        }
        return { ...metrics, importCount: imports.imports.length, localImportCount: imports.localCount };
    }
    catch {
        if (!signal.aborted) {
            post('imports', (0, analysis_panel_render_1.errorSlot)('imports', '📦 Import extraction failed'));
        }
        return metrics;
    }
}
async function runDocsScan(ctx, tokens) {
    const { post, signal, progress } = ctx;
    if (signal.aborted) {
        return {};
    }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) {
        post('docs', (0, analysis_panel_render_1.emptySlot)('docs', '📚 No workspace folder open'));
        return {};
    }
    try {
        const names = tokens.map(t => t.value);
        progress('docs', '📚 Scanning ' + names.length + ' tokens...');
        const results = await (0, docs_scanner_1.scanDocsForTokens)(names, wsFolder);
        if (!signal.aborted) {
            post('docs', (0, analysis_panel_render_1.renderDocsSection)(results));
        }
        return { docMatchCount: results.matches.length };
    }
    catch {
        if (!signal.aborted) {
            post('docs', (0, analysis_panel_render_1.errorSlot)('docs', '📚 Documentation scan failed'));
        }
        return {};
    }
}
async function runSymbolResolution(ctx, tokens) {
    const { post, signal, progress } = ctx;
    if (signal.aborted) {
        return {};
    }
    try {
        progress('symbols', '🔎 Querying language server...');
        const results = await (0, symbol_resolver_1.resolveSymbols)(tokens);
        if (!signal.aborted) {
            post('symbols', (0, analysis_panel_render_1.renderSymbolsSection)(results));
        }
        return { symbolCount: results.symbols.length };
    }
    catch {
        if (!signal.aborted) {
            post('symbols', (0, analysis_panel_render_1.errorSlot)('symbols', '🔎 Symbol resolution failed'));
        }
        return {};
    }
}
async function runTokenSearch(ctx, tokens) {
    const { post, signal, progress } = ctx;
    try {
        progress('tokens', '🔍 Searching ' + tokens.length + ' token' + (tokens.length > 1 ? 's' : '') + ' across sessions...');
        const groups = await Promise.all(tokens.map(async (token) => ({
            token, results: await (0, log_search_1.searchLogFiles)(token.value, { maxResults: 50, maxResultsPerFile: 10 }),
        })));
        if (signal.aborted) {
            return {};
        }
        post('tokens', (0, analysis_panel_render_1.renderTokenGroups)(groups));
        const total = groups.reduce((s, g) => s + g.results.matches.length, 0);
        const files = new Set(groups.flatMap(g => g.results.matches.map(m => m.filename))).size;
        return { tokenMatchCount: total, tokenFileCount: files };
    }
    catch {
        if (!signal.aborted) {
            post('tokens', (0, analysis_panel_render_1.errorSlot)('tokens', '🔍 Token search failed'));
        }
        return {};
    }
}
async function runCrossSessionLookup(progress, lineText) {
    try {
        const normalized = (0, error_fingerprint_1.normalizeLine)(lineText);
        if (normalized.length < 5) {
            return {};
        }
        const hash = (0, error_fingerprint_1.hashFingerprint)(normalized);
        progress('trend', '📊 Reading session metadata...');
        const insights = await (0, cross_session_aggregator_1.aggregateInsights)();
        const match = insights.recurringErrors.find(e => e.hash === hash);
        if (!match) {
            return {};
        }
        const firstDate = (0, stack_parser_1.extractDateFromFilename)(match.firstSeen);
        const trend = match.timeline
            .map(t => ({ date: (0, stack_parser_1.extractDateFromFilename)(t.session), count: t.count }))
            .filter((t) => t.date !== undefined)
            .sort((a, b) => a.date.localeCompare(b.date));
        return { crossSession: { sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences, firstSeenDate: firstDate, trend } };
    }
    catch {
        return {};
    }
}
async function runReferencedFiles(ctx, related) {
    const { post, signal, progress } = ctx;
    if (!related) {
        return {};
    }
    if (!related.uniqueFiles.length) {
        post('files', (0, analysis_panel_render_1.emptySlot)('files', '📁 No source files referenced'));
        return {};
    }
    progress('files', '📁 Analyzing ' + related.uniqueFiles.length + ' source files...');
    const refs = related.lines.filter(l => l.sourceRef).map(l => ({ ...l.sourceRef, text: l.text }));
    const uniqueRefs = [...new Map(refs.map(r => [r.file, r])).values()].slice(0, 5);
    const analyses = (await Promise.all(uniqueRefs.map(async (ref) => {
        if (signal.aborted) {
            return undefined;
        }
        const info = await (0, workspace_analyzer_1.analyzeSourceFile)(ref.file, ref.line, (0, source_linker_1.extractPackageHint)(ref.text)).catch(() => undefined);
        if (!info || signal.aborted) {
            return undefined;
        }
        const blame = await (0, git_blame_1.getGitBlame)(info.uri, ref.line).catch(() => undefined);
        return signal.aborted ? undefined : { filename: ref.file, line: ref.line, info, blame };
    }))).filter((a) => a !== undefined);
    if (!signal.aborted) {
        post('files', (0, analysis_related_render_1.renderReferencedFilesSection)(analyses));
    }
    return { relatedFileCount: analyses.length };
}
async function runGitHubLookup(ctx, related, tokens) {
    const { post, signal, progress } = ctx;
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
        post('github', (0, analysis_panel_render_1.emptySlot)('github', '🔗 No workspace folder open'));
        return {};
    }
    progress('github', '🔗 Checking GitHub CLI...');
    const files = related?.uniqueFiles ?? [];
    const errorTokens = (tokens ?? []).filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const fallback = { available: false, setupHint: 'GitHub query failed', filePrs: [], issues: [] };
    const ghCtx = await (0, github_context_1.getGitHubContext)({ files: [...files], errorTokens, cwd }).catch(() => fallback);
    if (!signal.aborted) {
        post('github', (0, analysis_related_render_1.renderGitHubSection)(ghCtx));
    }
    return { githubBlamePr: !!ghCtx.blamePr, githubPrCount: ghCtx.filePrs.length, githubIssueCount: ghCtx.issues.length };
}
async function runFirebaseLookup(ctx, tokens) {
    const { post, signal, progress } = ctx;
    progress('firebase', '🔥 Detecting Firebase config...');
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const fbCtx = await (0, firebase_crashlytics_1.getFirebaseContext)(errorTokens).catch(() => ({ available: false, setupHint: 'Firebase query failed', issues: [] }));
    if (!signal.aborted) {
        post('firebase', (0, analysis_related_render_1.renderFirebaseSection)(fbCtx));
    }
    const top = fbCtx.issues[0];
    const productionImpact = top ? { eventCount: top.eventCount, userCount: top.userCount, issueId: top.id } : undefined;
    return { crashlyticsIssueCount: fbCtx.issues.length, productionImpact };
}
//# sourceMappingURL=analysis-panel-streams.js.map