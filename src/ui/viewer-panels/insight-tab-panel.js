"use strict";
/**
 * Insights as a main VS Code editor tab.
 *
 * Opens a WebviewPanel that shows only the Insight panel content (same HTML/script
 * as the sidebar viewer's Insights), so users can read it in a large tab. Loading
 * states (e.g. "Loading error data…", "Loading…" for cases) are inherited from the
 * shared insight panel content; no extra spinners or progress UI in this module.
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
exports.openInsightTab = openInsightTab;
exports.disposeInsightTabPanel = disposeInsightTabPanel;
const vscode = __importStar(require("vscode"));
const viewer_content_1 = require("../provider/viewer-content");
const viewer_insight_panel_1 = require("../panels/viewer-insight-panel");
const viewer_styles_insight_1 = require("../viewer-styles/viewer-styles-insight");
const viewer_styles_session_1 = require("../viewer-styles/viewer-styles-session");
const viewer_styles_recurring_1 = require("../viewer-styles/viewer-styles-recurring");
const viewer_styles_performance_1 = require("../viewer-styles/viewer-styles-performance");
const viewer_message_handler_1 = require("../provider/viewer-message-handler");
const VIEW_TYPE = "saropaLogCapture.insightTab";
const TITLE = "Insights";
let panel;
/**
 * Build HTML for the standalone Insights tab: insight panel only, full viewport,
 * with styles and script. Panel is shown as visible by default.
 */
function buildInsightTabHtml(opts) {
    const { nonce, codiconCssUri, cspSource } = opts;
    const styleSrc = cspSource
        ? `style-src 'nonce-${nonce}' ${cspSource};`
        : `style-src 'nonce-${nonce}';`;
    const fontSrc = cspSource ? `font-src ${cspSource};` : "";
    const styles = (0, viewer_styles_insight_1.getInsightPanelStyles)() +
        (0, viewer_styles_session_1.getSessionPanelStyles)() +
        (0, viewer_styles_recurring_1.getRecurringPanelStyles)() +
        (0, viewer_styles_performance_1.getPerformancePanelStyles)();
    // Insight panel HTML: add class "visible" so it shows in the tab (no icon bar to toggle it).
    const insightHtml = (0, viewer_insight_panel_1.getInsightPanelHtml)().replace('id="insight-panel" class="insight-panel"', 'id="insight-panel" class="insight-panel visible"');
    // Provide vscodeApi and closeInsightPanel (close = close tab). Do not set openInsightPanel
    // so the insight script's implementation runs and requests data when we post openInsight.
    const bootstrapScript = `
(function() {
  var api = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;
  if (api) {
    window.vscodeApi = api;
    window.closeInsightPanel = function() { api.postMessage({ type: 'closeInsightTab' }); };
  }
})();
`;
    const insightScript = (0, viewer_insight_panel_1.getInsightPanelScript)();
    // Re-apply close handler after insight script (script overwrites closeInsightPanel for sidebar behavior).
    // Signal ready so extension posts openInsight only after the script has attached its message listener (avoids race).
    const closeTabScript = `
window.closeInsightPanel = function() { if (window.vscodeApi) window.vscodeApi.postMessage({ type: 'closeInsightTab' }); };
if (window.vscodeApi) window.vscodeApi.postMessage({ type: 'insightTabReady' });
`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; ${styleSrc} ${fontSrc};">
  <link rel="stylesheet" href="${codiconCssUri}">
  <style nonce="${nonce}">
    body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
    #insight-panel.visible { display: flex !important; width: 100%; height: 100%; min-height: 0; }
    ${styles}
  </style>
</head>
<body>
  ${insightHtml}
  <script nonce="${nonce}">${bootstrapScript}</script>
  <script nonce="${nonce}">${insightScript}</script>
  <script nonce="${nonce}">${closeTabScript}</script>
</body>
</html>`;
}
/**
 * Open the Insights tab or reveal it if already open.
 */
function openInsightTab(deps) {
    const { getCurrentFileUri, context, extensionUri, version } = deps;
    if (panel) {
        panel.reveal();
        return;
    }
    const codiconsUri = vscode.Uri.joinPath(extensionUri, "media", "codicons");
    panel = vscode.window.createWebviewPanel(VIEW_TYPE, TITLE, vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [codiconsUri],
    });
    const webview = panel.webview;
    const codiconCssUri = webview.asWebviewUri(vscode.Uri.joinPath(codiconsUri, "codicon.css")).toString();
    const nonce = (0, viewer_content_1.getNonce)();
    webview.html = buildInsightTabHtml({
        nonce,
        codiconCssUri,
        cspSource: webview.cspSource,
    });
    const ctx = {
        currentFileUri: getCurrentFileUri(),
        isSessionActive: false,
        context,
        extensionVersion: version,
        post: (msg) => {
            if (panel?.webview) {
                panel.webview.postMessage(msg);
            }
        },
        load: async () => { },
    };
    webview.onDidReceiveMessage((msg) => {
        if (msg?.type === "closeInsightTab") {
            panel?.dispose();
            return;
        }
        // Tab signals ready after script has attached listeners; then we trigger data load (avoids posting before webview ready).
        if (msg?.type === "insightTabReady") {
            if (panel?.webview) {
                panel.webview.postMessage({ type: "openInsight", tab: "recurring" });
            }
            return;
        }
        // Refresh currentFileUri so "This log" section stays in sync if user switched logs.
        const freshCtx = {
            ...ctx,
            currentFileUri: getCurrentFileUri(),
        };
        (0, viewer_message_handler_1.dispatchViewerMessage)(msg, freshCtx);
    });
    panel.onDidDispose(() => {
        panel = undefined;
    });
}
function disposeInsightTabPanel() {
    panel?.dispose();
    panel = undefined;
}
//# sourceMappingURL=insight-tab-panel.js.map