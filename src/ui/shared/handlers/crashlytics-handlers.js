"use strict";
/**
 * Crashlytics Handlers
 *
 * Handlers for Crashlytics panel operations including data fetching,
 * issue actions, and authentication.
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
exports.handleCrashlyticsRequest = handleCrashlyticsRequest;
exports.handleCrashDetail = handleCrashDetail;
exports.handleCrashlyticsAction = handleCrashlyticsAction;
exports.handleGcloudAuth = handleGcloudAuth;
exports.handleBrowseGoogleServices = handleBrowseGoogleServices;
exports.handleOpenGoogleServicesJson = handleOpenGoogleServicesJson;
exports.handleOpenGcloudInstall = handleOpenGcloudInstall;
exports.handleCrashlyticsShowOutput = handleCrashlyticsShowOutput;
exports.startCrashlyticsAutoRefresh = startCrashlyticsAutoRefresh;
exports.stopCrashlyticsAutoRefresh = stopCrashlyticsAutoRefresh;
exports.disposeCrashlyticsHandlers = disposeCrashlyticsHandlers;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../../l10n");
const firebase_crashlytics_1 = require("../../../modules/crashlytics/firebase-crashlytics");
const analysis_crash_detail_1 = require("../../analysis/analysis-crash-detail");
const crashlytics_serializers_1 = require("./crashlytics-serializers");
const crashlytics_diagnostics_1 = require("../../../modules/crashlytics/crashlytics-diagnostics");
let refreshTimer;
let terminalListener;
/** Fetch Crashlytics context and send to webview. Never throws. */
async function handleCrashlyticsRequest(post) {
    try {
        (0, firebase_crashlytics_1.clearIssueListCache)();
        const raw = await (0, firebase_crashlytics_1.getFirebaseContext)([]);
        const ctx = raw ?? { available: false, setupHint: 'Query failed', issues: [] };
        const gcloudInstallCommand = (0, firebase_crashlytics_1.getGcloudInstallCommand)();
        let workspaceGoogleServicesPath;
        if (ctx.setupStep === 'config') {
            const uri = await (0, firebase_crashlytics_1.findBestGoogleServicesJson)();
            if (uri) {
                const ws = vscode.workspace.workspaceFolders?.[0];
                workspaceGoogleServicesPath = ws ? vscode.workspace.asRelativePath(uri) : uri.fsPath;
            }
        }
        post({ type: 'crashlyticsData', context: (0, crashlytics_serializers_1.serializeContext)(ctx, { gcloudInstallCommand, workspaceGoogleServicesPath }) });
    }
    catch {
        const fallbackChecklist = { gcloud: 'missing', token: 'pending', config: 'pending' };
        post({ type: 'crashlyticsData', context: (0, crashlytics_serializers_1.serializeContext)({ available: false, setupHint: 'Unexpected error', setupChecklist: fallbackChecklist, issues: [] }) });
    }
}
/** Fetch crash detail for a specific issue and send HTML to webview. Never throws. */
async function handleCrashDetail(issueId, post) {
    try {
        const multi = await (0, firebase_crashlytics_1.getCrashEvents)(issueId);
        const detail = multi?.events[multi.currentIndex ?? 0];
        const html = detail ? (0, analysis_crash_detail_1.renderCrashDetail)(detail) : '<div class="no-matches">Crash details not available</div>';
        post({ type: 'crashDetailReady', issueId, html });
    }
    catch {
        post({ type: 'crashDetailReady', issueId, html: '<div class="no-matches">Crash details not available</div>' });
    }
}
/** Close or mute a Crashlytics issue, then refresh. Never throws. */
async function handleCrashlyticsAction(issueId, state, post) {
    try {
        const ok = await (0, firebase_crashlytics_1.updateIssueState)(issueId, state);
        if (ok) {
            await handleCrashlyticsRequest(post);
        }
        else {
            post({ type: 'issueActionFailed', action: state });
        }
    }
    catch {
        post({ type: 'issueActionFailed', action: state });
    }
}
/** Open a terminal and run gcloud auth; auto-refresh on terminal close. */
function handleGcloudAuth(post) {
    const terminal = vscode.window.createTerminal({ name: 'Google Cloud Auth' });
    terminal.show();
    terminal.sendText('gcloud auth application-default login');
    terminalListener?.dispose();
    terminalListener = vscode.window.onDidCloseTerminal(closed => {
        if (closed !== terminal) {
            return;
        }
        terminalListener?.dispose();
        terminalListener = undefined;
        handleCrashlyticsRequest(post);
    });
}
/** Show file picker for google-services.json and copy to workspace root. Never throws. */
async function handleBrowseGoogleServices(post) {
    try {
        const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'JSON': ['json'] },
            openLabel: 'Select google-services.json',
        });
        if (!files || files.length === 0) {
            return;
        }
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            return;
        }
        const dest = vscode.Uri.joinPath(ws.uri, 'google-services.json');
        await vscode.workspace.fs.copy(files[0], dest, { overwrite: true });
        await handleCrashlyticsRequest(post);
    }
    catch {
        // Silently ignore so we never crash the app
    }
}
/** Open google-services.json in the workspace (prefers android/app/). Shows progress while resolving. Never throws. */
async function handleOpenGoogleServicesJson() {
    try {
        const uri = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Opening google-services.json…' }, () => (0, firebase_crashlytics_1.findBestGoogleServicesJson)());
        if (uri) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
        }
        else {
            await vscode.window.showInformationMessage((0, l10n_1.t)('msg.noGoogleServicesJson'));
        }
    }
    catch {
        await vscode.window.showInformationMessage((0, l10n_1.t)('msg.noGoogleServicesJson'));
    }
}
/** Open the gcloud install URL. */
function handleOpenGcloudInstall() {
    vscode.env.openExternal(vscode.Uri.parse(firebase_crashlytics_1.gcloudInstallUrl)).then(undefined, () => { });
}
/** Show the Saropa Log Capture output channel (where Crashlytics logs and errors are written). */
function handleCrashlyticsShowOutput() {
    (0, crashlytics_diagnostics_1.getOutputChannel)().show();
}
/** Start periodic Crashlytics auto-refresh. */
function startCrashlyticsAutoRefresh(post) {
    stopCrashlyticsAutoRefresh();
    const interval = vscode.workspace
        .getConfiguration('saropaLogCapture.firebase')
        .get('refreshInterval', 300);
    if (interval > 0) {
        refreshTimer = setInterval(() => { handleCrashlyticsRequest(post); }, interval * 1000);
    }
}
/** Stop periodic Crashlytics auto-refresh. */
function stopCrashlyticsAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
}
/** Dispose terminal listener and stop auto-refresh. */
function disposeCrashlyticsHandlers() {
    stopCrashlyticsAutoRefresh();
    terminalListener?.dispose();
    terminalListener = undefined;
}
//# sourceMappingURL=crashlytics-handlers.js.map