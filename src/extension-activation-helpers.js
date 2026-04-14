"use strict";
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
exports.maybeSuggestSmartBookmark = maybeSuggestSmartBookmark;
exports.showWalkthroughOnFirstInstall = showWalkthroughOnFirstInstall;
exports.autoLoadLatest = autoLoadLatest;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const session_history_grouping_1 = require("./ui/session/session-history-grouping");
const viewer_provider_helpers_1 = require("./ui/provider/viewer-provider-helpers");
const walkthroughShownKey = 'slc.walkthroughShown';
/**
 * Smart bookmarks: after a log loads, suggest adding a bookmark at the first error (or warning) line.
 * One suggestion per file per session; skipped if that line already has a bookmark.
 */
async function maybeSuggestSmartBookmark(uri, loadResult, bookmarkStore, suggestedForUri) {
    if (!loadResult) {
        return;
    }
    const cfg = (0, config_1.getConfig)().smartBookmarks;
    let candidate;
    if (cfg.suggestFirstError && loadResult.firstError) {
        candidate = loadResult.firstError;
    }
    else if (cfg.suggestFirstWarning && loadResult.firstWarning) {
        candidate = loadResult.firstWarning;
    }
    else {
        candidate = undefined;
    }
    if (!candidate) {
        return;
    }
    const uriStr = uri.toString();
    if (suggestedForUri.has(uriStr)) {
        return;
    }
    const existing = bookmarkStore.getForFile(uriStr);
    if (existing.some((b) => b.lineIndex === candidate.lineIndex)) {
        return;
    }
    const lineNum = candidate.lineIndex + 1;
    const message = candidate.level === 'error'
        ? (0, l10n_1.t)('msg.smartBookmarkFirstError', String(lineNum))
        : (0, l10n_1.t)('msg.smartBookmarkFirstWarning', String(lineNum));
    const addLabel = (0, l10n_1.t)('action.addBookmark');
    const dismissLabel = (0, l10n_1.t)('action.dismiss');
    const choice = await vscode.window.showInformationMessage(message, addLabel, dismissLabel);
    suggestedForUri.add(uriStr);
    if (choice === addLabel) {
        const filename = uri.path.split(/[/\\]/).pop() ?? '';
        bookmarkStore.add({
            fileUri: uriStr,
            filename,
            lineIndex: candidate.lineIndex,
            lineText: candidate.lineText,
            note: '',
        });
    }
}
/** Show the Getting Started walkthrough once on first install. */
function showWalkthroughOnFirstInstall(context) {
    if (context.globalState.get(walkthroughShownKey)) {
        return;
    }
    void context.globalState.update(walkthroughShownKey, true);
    void vscode.commands.executeCommand('workbench.action.openWalkthrough', 'saropa.saropa-log-capture#saropaLogCapture.getStarted', false);
}
/** Get the display name for a tree item. */
function getItemName(item) {
    if ((0, session_history_grouping_1.isSplitGroup)(item)) {
        return item.displayName ?? item.baseFilename;
    }
    return item.displayName ?? item.filename;
}
/** Find the most recently viewed URI from the last-viewed workspace state map. */
function findLastViewedUri(lastViewedMap) {
    let best;
    let bestTime = 0;
    for (const [uri, time] of Object.entries(lastViewedMap)) {
        if (time > bestTime) {
            bestTime = time;
            best = uri;
        }
    }
    return best;
}
/**
 * Auto-load the latest log into the viewer on first visit.
 * Called after the session list streaming fetch completes — items are already loaded, no extra I/O.
 * If a different session was last viewed, sends a `showResumeSession` message
 * so the webview can offer a quick-switch button.
 */
async function autoLoadLatest(context, items, target) {
    const latest = items.find(i => (0, session_history_grouping_1.isSplitGroup)(i) || !i.trashed);
    if (!latest) {
        return;
    }
    const latestUri = (0, session_history_grouping_1.getTreeItemUri)(latest);
    void target.loadFromFile(latestUri);
    // Offer resume if a different session was last viewed.
    const lastViewedMap = context.workspaceState.get(viewer_provider_helpers_1.LOG_LAST_VIEWED_KEY, {});
    const lastViewedUriStr = findLastViewedUri(lastViewedMap);
    if (!lastViewedUriStr || lastViewedUriStr === latestUri.toString()) {
        return;
    }
    const lastItem = items.find(i => {
        if ((0, session_history_grouping_1.isSplitGroup)(i)) {
            return i.parts.some(p => p.uri.toString() === lastViewedUriStr);
        }
        return i.uri.toString() === lastViewedUriStr;
    });
    if (!lastItem) {
        return;
    }
    target.postMessage({
        type: 'showResumeSession',
        uriString: lastViewedUriStr,
        name: getItemName(lastItem),
    });
}
//# sourceMappingURL=extension-activation-helpers.js.map