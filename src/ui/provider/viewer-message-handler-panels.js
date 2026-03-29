"use strict";
/**
 * Panel and settings message handlers extracted from viewer-message-handler.ts
 * to keep the main handler under the line limit.
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
exports.safeLineIndex = safeLineIndex;
exports.dispatchPanelMessage = dispatchPanelMessage;
const vscode = __importStar(require("vscode"));
const integration_adapter_constants_1 = require("../../modules/integrations/integration-adapter-constants");
const drift_advisor_integration_1 = require("./drift-advisor-integration");
const panelHandlers = __importStar(require("../shared/viewer-panel-handlers"));
const about_content_loader_1 = require("../viewer-panels/about-content-loader");
const error_hover_handler_1 = require("../shared/handlers/error-hover-handler");
const analysis_panel_1 = require("../analysis/analysis-panel");
const code_quality_handlers_1 = require("../shared/handlers/code-quality-handlers");
const drift_viewer_health_1 = require("../../modules/integrations/drift-viewer-health");
const extension_logger_1 = require("../../modules/misc/extension-logger");
/** Clamp numeric param to safe integer range for line/part indices (0 .. 10M). */
const MAX_SAFE_INDEX = 10_000_000;
function safeLineIndex(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SAFE_INDEX) {
        return fallback;
    }
    return Math.floor(n);
}
/**
 * Handle panel-related messages (crashlytics, performance, settings, about).
 * Returns true if the message was handled.
 */
function dispatchPanelMessage(msg, ctx) {
    switch (msg.type) {
        case "scriptError":
            (msg.errors ?? []).forEach(e => {
                const loc = e.line ? ` (line ${e.line}, col ${e.col ?? 0})` : '';
                (0, extension_logger_1.logExtensionError)('Webview', `${e.message}${loc}`);
                if (e.stack) {
                    (0, extension_logger_1.logExtensionError)('Webview', `Stack: ${e.stack}`);
                }
            });
            return true;
        case "requestCrashlyticsData":
        case "crashlyticsCheckAgain":
            panelHandlers.handleCrashlyticsRequest(ctx.post).catch(() => { });
            return true;
        case "fetchCrashDetail":
            panelHandlers.handleCrashDetail(String(msg.issueId ?? ''), ctx.post).catch(() => { });
            return true;
        case "crashlyticsCloseIssue":
        case "crashlyticsMuteIssue":
            panelHandlers.handleCrashlyticsAction(String(msg.issueId ?? ''), msg.type === "crashlyticsCloseIssue" ? 'CLOSED' : 'MUTED', ctx.post).catch(() => { });
            return true;
        case "crashlyticsRunGcloudAuth":
            panelHandlers.handleGcloudAuth(ctx.post);
            return true;
        case "crashlyticsBrowseGoogleServices":
            panelHandlers.handleBrowseGoogleServices(ctx.post).catch(() => { });
            return true;
        case "crashlyticsOpenGoogleServicesJson":
            panelHandlers.handleOpenGoogleServicesJson().catch(() => { });
            return true;
        case "openGcloudInstall":
            panelHandlers.handleOpenGcloudInstall();
            return true;
        case "crashlyticsShowOutput":
            panelHandlers.handleCrashlyticsShowOutput();
            return true;
        case "crashlyticsPanelOpened":
            panelHandlers.startCrashlyticsAutoRefresh(ctx.post);
            return true;
        case "crashlyticsPanelClosed":
            panelHandlers.stopCrashlyticsAutoRefresh();
            return true;
        case "requestRecurringErrors":
            panelHandlers.handleRecurringRequest(ctx.post).catch(() => { });
            return true;
        case "requestInsightData":
            panelHandlers.handleInsightDataRequest(ctx.post, ctx.currentFileUri).catch(() => { });
            return true;
        case "requestPerformanceData":
            panelHandlers.handlePerformanceRequest(ctx.post, ctx.currentFileUri).catch(() => { });
            return true;
        case "setRecurringErrorStatus":
            panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post).catch(() => { });
            return true;
        case "openInsights":
            ctx.post({ type: 'openInsight', tab: 'recurring' });
            return true;
        case "addInsightItemToCase":
            vscode.commands.executeCommand('saropaLogCapture.addInsightItemToCase', msg.payload);
            return true;
        case "exportInsightsSummary":
            vscode.commands.executeCommand('saropaLogCapture.exportInsightsSummary');
            return true;
        case "requestAboutContent":
            void (0, about_content_loader_1.loadAndPostAboutContent)(ctx.context.extensionUri, ctx.extensionVersion, ctx.context.extension.id, ctx.post);
            return true;
        case "resetAllSettings":
            void vscode.commands.executeCommand('saropaLogCapture.resetAllSettings');
            return true;
        case "setCaptureEnabled": {
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const enabled = msg.enabled === true;
            void cfg.update('enabled', enabled, vscode.ConfigurationTarget.Workspace).then(() => {
                ctx.post({ type: 'captureEnabled', enabled });
            });
            return true;
        }
        case "setIntegrationsAdapters": {
            const raw = msg.adapterIds;
            const adapterIds = Array.isArray(raw)
                ? raw.filter((x) => typeof x === 'string')
                : [];
            const aiEnabled = adapterIds.includes(integration_adapter_constants_1.EXPLAIN_WITH_AI_ADAPTER_ID);
            const sessionOnly = (0, integration_adapter_constants_1.stripUiOnlyIntegrationAdapterIds)(adapterIds);
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
            void Promise.all([
                cfg.update('integrations.adapters', sessionOnly, vscode.ConfigurationTarget.Workspace),
                aiCfg.update('enabled', aiEnabled, vscode.ConfigurationTarget.Workspace),
            ]).then(() => {
                const merged = (0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(sessionOnly, aiEnabled);
                ctx.post({ type: 'integrationsAdapters', adapterIds: merged });
                ctx.post({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(drift_advisor_integration_1.DRIFT_ADVISOR_EXTENSION_ID) });
                void import('../../modules/integrations/integration-prep.js').then((m) => m.runIntegrationPrepCheck(sessionOnly));
            });
            return true;
        }
        case "showIntegrationContext":
            panelHandlers.handleIntegrationContextRequest(ctx.currentFileUri, safeLineIndex(msg.lineIndex, 0), ctx.post, {
                timestamp: msg.timestamp,
                hasDatabaseLine: msg.hasDatabaseLine === true,
                lineText: typeof msg.lineText === 'string' ? msg.lineText : undefined,
            }).catch(() => { });
            return true;
        case "openFullIntegrationContext":
            panelHandlers.handleIntegrationContextDocument(ctx.currentFileUri, safeLineIndex(msg.lineIndex, 0)).catch(() => { });
            return true;
        case "requestErrorHoverData":
            (0, error_hover_handler_1.handleErrorHoverRequest)(String(msg.text ?? ''), safeLineIndex(msg.lineIndex, 0), ctx.post).catch(() => { });
            return true;
        case "openErrorAnalysis":
            (0, analysis_panel_1.showAnalysis)(String(msg.text ?? ''), safeLineIndex(msg.lineIndex, 0), ctx.currentFileUri).catch(() => { });
            return true;
        case "showCodeQualityForFrame":
            (0, code_quality_handlers_1.handleCodeQualityForFrameRequest)(ctx.currentFileUri, safeLineIndex(msg.lineIndex, 0), String(msg.lineText ?? msg.text ?? ''), ctx.post).catch(() => { });
            return true;
        case "openQualityReport":
            void vscode.commands.executeCommand('saropaLogCapture.openQualityReport');
            return true;
        case "openDriftAdvisor":
            void vscode.commands.executeCommand(drift_advisor_integration_1.DRIFT_ADVISOR_OPEN_COMMAND).then(undefined, () => { });
            return true;
        case "checkDriftViewerHealth": {
            const baseUrl = String(msg.baseUrl ?? "").trim();
            if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
                return true;
            }
            void (0, drift_viewer_health_1.fetchDriftViewerHealth)(baseUrl).then((r) => {
                ctx.post({
                    type: "driftViewerHealth",
                    baseUrl,
                    ok: r.ok,
                    version: r.version,
                    error: r.error,
                });
            });
            return true;
        }
        case "showRelatedQueries":
            panelHandlers.handleRelatedQueriesRequest(ctx.currentFileUri, safeLineIndex(msg.lineIndex, 0), ctx.post, {
                timestamp: msg.timestamp,
                lineText: typeof msg.lineText === 'string' ? msg.lineText : undefined,
            }).catch(() => { });
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=viewer-message-handler-panels.js.map