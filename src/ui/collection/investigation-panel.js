"use strict";
/**
 * Investigation mode webview panel.
 * Shows pinned sources, cross-source search, notes, and export actions.
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
exports.showInvestigationPanel = showInvestigationPanel;
exports.disposeInvestigationPanel = disposeInvestigationPanel;
exports.refreshInvestigationPanelIfOpen = refreshInvestigationPanelIfOpen;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const bug_report_collector_1 = require("../../modules/bug-report/bug-report-collector");
const bug_report_formatter_1 = require("../../modules/bug-report/bug-report-formatter");
const bug_report_panel_1 = require("../panels/bug-report-panel");
const investigation_panel_html_1 = require("./investigation-panel-html");
const investigation_panel_handlers_1 = require("./investigation-panel-handlers");
let panel;
let currentStore;
/** Show the investigation panel for the active investigation. */
async function showInvestigationPanel(store) {
    currentStore = store;
    ensurePanel();
    await refreshPanel();
}
/** Dispose the singleton panel. */
function disposeInvestigationPanel() {
    panel?.dispose();
    panel = undefined;
}
function ensurePanel() {
    if (panel) {
        panel.reveal();
        return;
    }
    panel = vscode.window.createWebviewPanel('saropaLogCapture.investigation', 'Investigation', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}
async function refreshPanel() {
    if (!panel || !currentStore) {
        return;
    }
    const investigation = await currentStore.getActiveInvestigation();
    panel.title = investigation ? `Investigation: ${investigation.name}` : 'Investigation';
    let missingSources = [];
    if (investigation) {
        missingSources = await (0, investigation_panel_handlers_1.checkMissingSources)(investigation);
    }
    panel.webview.html = investigation
        ? (0, investigation_panel_html_1.buildInvestigationHtml)(investigation, missingSources)
        : (0, investigation_panel_html_1.buildNoInvestigationHtml)();
    if (investigation?.lastSearchQuery) {
        const result = await (0, investigation_panel_handlers_1.performSearch)(investigation, { query: investigation.lastSearchQuery });
        panel.webview.postMessage({ type: 'searchResults', html: (0, investigation_panel_handlers_1.renderSearchResultsCompact)(result, investigation.lastSearchQuery) });
    }
}
/** Refresh the panel if it's currently open (called after external changes). */
async function refreshInvestigationPanelIfOpen() {
    if (panel && currentStore) {
        await refreshPanel();
    }
}
async function handleMessage(msg) {
    if (!currentStore) {
        return;
    }
    switch (msg.type) {
        case 'close':
            await currentStore.setActiveInvestigationId(undefined);
            disposeInvestigationPanel();
            break;
        case 'addSource':
            await (0, investigation_panel_handlers_1.promptAddSource)(currentStore, refreshPanel);
            break;
        case 'removeSource':
            await (0, investigation_panel_handlers_1.handleRemoveSource)(currentStore, String(msg.path ?? ''), refreshPanel);
            break;
        case 'openSource':
            await (0, investigation_panel_handlers_1.handleOpenSource)(String(msg.path ?? ''));
            break;
        case 'openResult':
            await (0, investigation_panel_handlers_1.handleOpenResult)(String(msg.path ?? ''), Number(msg.line ?? 1));
            break;
        case 'search':
            if (panel) {
                const options = {
                    query: String(msg.query ?? ''),
                    caseSensitive: Boolean(msg.caseSensitive ?? false),
                    useRegex: Boolean(msg.useRegex ?? false),
                    contextLines: typeof msg.contextLines === 'number' ? msg.contextLines : 2,
                };
                await (0, investigation_panel_handlers_1.handleSearch)(currentStore, options, panel);
            }
            break;
        case 'getSearchHistory':
            if (panel) {
                const historyHtml = await (0, investigation_panel_handlers_1.getSearchHistoryHtml)(currentStore);
                panel.webview.postMessage({ type: 'searchHistory', html: historyHtml });
            }
            break;
        case 'clearSearchHistory':
            await (0, investigation_panel_handlers_1.handleClearSearchHistory)(currentStore);
            if (panel) {
                const historyHtml = await (0, investigation_panel_handlers_1.getSearchHistoryHtml)(currentStore);
                panel.webview.postMessage({ type: 'searchHistory', html: historyHtml });
            }
            break;
        case 'updateNotes':
            await (0, investigation_panel_handlers_1.handleUpdateNotes)(currentStore, String(msg.notes ?? ''));
            break;
        case 'export':
            await vscode.commands.executeCommand('saropaLogCapture.exportInvestigation');
            break;
        case 'openSlc':
            // Opens file picker for .slc (session or investigation bundle); same as Command Palette → Import .slc Bundle
            await vscode.commands.executeCommand('saropaLogCapture.importSlc');
            break;
        case 'share':
            await vscode.commands.executeCommand('saropaLogCapture.shareInvestigation');
            break;
        case 'generateReport': {
            const invContext = await (0, bug_report_collector_1.collectInvestigationContext)(currentStore);
            if (!invContext) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noActiveInvestigation'));
                break;
            }
            const minimalData = {
                errorLine: '',
                fingerprint: '',
                stackTrace: [],
                logContext: [],
                environment: {},
                devEnvironment: {},
                logFilename: '',
                lineNumber: 1,
                gitHistory: [],
                lineRangeHistory: [],
                fileAnalyses: [],
                investigationContext: invContext,
            };
            const markdown = (0, bug_report_formatter_1.formatBugReport)(minimalData);
            (0, bug_report_panel_1.showBugReportFromMarkdown)(markdown);
            break;
        }
        case 'create':
            await vscode.commands.executeCommand('saropaLogCapture.createInvestigation');
            break;
    }
}
//# sourceMappingURL=investigation-panel.js.map