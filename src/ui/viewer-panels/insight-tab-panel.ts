/**
 * Insights as a main VS Code editor tab.
 *
 * Opens a WebviewPanel that shows only the Insight panel content (same HTML/script
 * as the sidebar viewer's Insights), so users can read it in a large tab. Loading
 * states (e.g. "Loading error data…", "Loading…" for cases) are inherited from the
 * shared insight panel content; no extra spinners or progress UI in this module.
 */

import * as vscode from "vscode";
import { getNonce } from "../provider/viewer-content";
import { getInsightPanelHtml, getInsightPanelScript } from "../panels/viewer-insight-panel";
import { getInsightPanelStyles } from "../viewer-styles/viewer-styles-insight";
import { getSessionPanelStyles } from "../viewer-styles/viewer-styles-session";
import { getRecurringPanelStyles } from "../viewer-styles/viewer-styles-recurring";
import { getPerformancePanelStyles } from "../viewer-styles/viewer-styles-performance";
import { dispatchViewerMessage, type ViewerMessageContext } from "../provider/viewer-message-handler";

const VIEW_TYPE = "saropaLogCapture.insightTab";
const TITLE = "Insights";

let panel: vscode.WebviewPanel | undefined;

export type OpenInsightTabDeps = {
  getCurrentFileUri: () => vscode.Uri | undefined;
  context: vscode.ExtensionContext;
  extensionUri: vscode.Uri;
  version: string;
};

/**
 * Build HTML for the standalone Insights tab: insight panel only, full viewport,
 * with styles and script. Panel is shown as visible by default.
 */
function buildInsightTabHtml(opts: {
  nonce: string;
  codiconCssUri: string;
  cspSource: string;
}): string {
  const { nonce, codiconCssUri, cspSource } = opts;
  const styleSrc = cspSource
    ? `style-src 'nonce-${nonce}' ${cspSource};`
    : `style-src 'nonce-${nonce}';`;
  const fontSrc = cspSource ? `font-src ${cspSource};` : "";

  const styles =
    getInsightPanelStyles() +
    getSessionPanelStyles() +
    getRecurringPanelStyles() +
    getPerformancePanelStyles();

  // Insight panel HTML: add class "visible" so it shows in the tab (no icon bar to toggle it).
  const insightHtml = getInsightPanelHtml().replace(
    'id="insight-panel" class="insight-panel"',
    'id="insight-panel" class="insight-panel visible"'
  );

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

  const insightScript = getInsightPanelScript();
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
export function openInsightTab(deps: OpenInsightTabDeps): void {
  const { getCurrentFileUri, context, extensionUri, version } = deps;

  if (panel) {
    panel.reveal();
    return;
  }

  const codiconsUri = vscode.Uri.joinPath(extensionUri, "media", "codicons");
  panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    TITLE,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [codiconsUri],
    }
  );

  const webview = panel.webview;
  const codiconCssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(codiconsUri, "codicon.css")
  ).toString();
  const nonce = getNonce();

  webview.html = buildInsightTabHtml({
    nonce,
    codiconCssUri,
    cspSource: webview.cspSource,
  });

  const ctx: ViewerMessageContext = {
    currentFileUri: getCurrentFileUri(),
    isSessionActive: false,
    context,
    extensionVersion: version,
    post: (msg: unknown) => {
      if (panel?.webview) panel.webview.postMessage(msg);
    },
    load: async () => {},
  };

  webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
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
    const freshCtx: ViewerMessageContext = {
      ...ctx,
      currentFileUri: getCurrentFileUri(),
    };
    dispatchViewerMessage(msg, freshCtx);
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

export function disposeInsightTabPanel(): void {
  panel?.dispose();
  panel = undefined;
}
