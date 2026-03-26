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
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
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
//# sourceMappingURL=extension-activation-helpers.js.map