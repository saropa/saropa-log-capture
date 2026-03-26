"use strict";
/**
 * Insights export command and scope resolution.
 * Extracted to keep commands-export.ts under the line limit.
 */
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
exports.resolveInsights = resolveInsights;
exports.exportInsightsSummaryCmd = exportInsightsSummaryCmd;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const insights_export_formats_1 = require("./modules/export/insights-export-formats");
const cross_session_aggregator_1 = require("./modules/misc/cross-session-aggregator");
const metadata_loader_1 = require("./modules/session/metadata-loader");
const insights_summary_1 = require("./modules/insights/insights-summary");
/** Resolve cross-session insights for the chosen scope (current session, investigation, 7d, or all). */
async function resolveInsights(scope, viewerProvider, investigationStore) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return null;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    if (scope === 'currentSession') {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) {
            return null;
        }
        const rel = path.relative(logDir.fsPath, uri.fsPath);
        const normalized = rel.split(path.sep).join('/');
        if (normalized.startsWith('..')) {
            return null;
        }
        const metas = await (0, metadata_loader_1.loadMetasForPaths)(logDir, [normalized]);
        return metas.length > 0 ? (0, cross_session_aggregator_1.buildInsightsFromMetas)(metas) : null;
    }
    if (scope === 'investigation') {
        const inv = await investigationStore.getActiveInvestigation();
        if (!inv?.sources?.length) {
            return null;
        }
        const sessionPaths = inv.sources
            .filter(s => s.type === 'session')
            .map(s => path.relative(logDir.fsPath, path.join(folder.uri.fsPath, s.relativePath)))
            .map(p => p.split(path.sep).join('/'));
        const validPaths = sessionPaths.filter(p => !p.startsWith('..'));
        if (validPaths.length === 0) {
            return null;
        }
        const metas = await (0, metadata_loader_1.loadMetasForPaths)(logDir, validPaths);
        return metas.length > 0 ? (0, cross_session_aggregator_1.buildInsightsFromMetas)(metas) : null;
    }
    if (scope === '7d') {
        return (0, cross_session_aggregator_1.aggregateInsights)('7d');
    }
    return (0, cross_session_aggregator_1.aggregateInsights)('all');
}
function exportInsightsSummaryCmd(viewerProvider, investigationStore) {
    return vscode.commands.registerCommand('saropaLogCapture.exportInsightsSummary', async () => {
        const scopeItem = await vscode.window.showQuickPick([
            { label: (0, l10n_1.t)('insightsExport.scope.currentSession'), value: 'currentSession' },
            { label: (0, l10n_1.t)('insightsExport.scope.investigation'), value: 'investigation' },
            { label: (0, l10n_1.t)('insightsExport.scope.last7Days'), value: '7d' },
            { label: (0, l10n_1.t)('insightsExport.scope.all'), value: 'all' },
        ], { title: (0, l10n_1.t)('insightsExport.scopeTitle'), placeHolder: (0, l10n_1.t)('insightsExport.scopePlaceholder') });
        if (!scopeItem) {
            return;
        }
        const insights = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('insightsExport.progress') }, async () => resolveInsights(scopeItem.value, viewerProvider, investigationStore));
        if (!insights) {
            void vscode.window.showWarningMessage((0, l10n_1.t)('insightsExport.noData'));
            return;
        }
        const formatItem = await vscode.window.showQuickPick([
            { label: 'CSV', value: 'csv' },
            { label: 'JSON', value: 'json' },
        ], { title: (0, l10n_1.t)('insightsExport.formatTitle'), placeHolder: (0, l10n_1.t)('insightsExport.formatPlaceholder') });
        if (!formatItem) {
            return;
        }
        const timeRangeLabel = scopeItem.value === '7d' ? '7d' : scopeItem.value === 'all' ? 'all' : scopeItem.value === 'investigation' ? 'investigation' : 'session';
        const summary = (0, insights_summary_1.buildInsightsSummary)(insights, { timeRangeLabel });
        const ext = formatItem.value;
        const defaultName = `insights-summary.${ext}`;
        const filters = ext === 'json' ? { JSON: ['json'] } : { CSV: ['csv'] };
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters,
            title: (0, l10n_1.t)('insightsExport.saveTitle'),
        });
        if (!uri) {
            return;
        }
        const content = formatItem.value === 'json'
            ? (0, insights_export_formats_1.formatInsightsSummaryToJson)(summary)
            : (0, insights_export_formats_1.formatInsightsSummaryToCsv)(summary);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedTo', uri.fsPath.split(/[\\/]/).pop() ?? ''), (0, l10n_1.t)('action.open'));
        if (action === (0, l10n_1.t)('action.open')) {
            await vscode.window.showTextDocument(uri);
        }
    });
}
//# sourceMappingURL=commands-export-insights.js.map