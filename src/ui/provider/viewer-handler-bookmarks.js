"use strict";
/**
 * Bookmark handler wiring for viewer targets.
 * Extracted from viewer-handler-wiring.ts for file-length compliance.
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
exports.wireBookmarkHandlers = wireBookmarkHandlers;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
/** Wire bookmark-related handlers on a viewer target. */
function wireBookmarkHandlers(target, deps) {
    const { sessionManager, broadcaster, bookmarkStore } = deps;
    target.setAddBookmarkHandler((lineIndex, text, fileUri) => {
        const uri = fileUri ?? sessionManager.getActiveSession()?.fileUri;
        if (!uri) {
            return;
        }
        const filename = uri.path.split('/').pop() ?? '';
        bookmarkStore.add({ fileUri: uri.toString(), filename, lineIndex, lineText: text, note: '' });
    });
    target.setBookmarkActionHandler((msg) => {
        const type = String(msg.type ?? '');
        if (type === 'requestBookmarks') {
            broadcaster.sendBookmarkList(bookmarkStore.getAll());
        }
        else if (type === 'deleteBookmark') {
            bookmarkStore.remove(String(msg.fileUri ?? ''), String(msg.bookmarkId ?? ''));
        }
        else if (type === 'deleteFileBookmarks') {
            void confirmDeleteFileBookmarks(bookmarkStore, msg);
        }
        else if (type === 'deleteAllBookmarks') {
            void confirmDeleteAllBookmarks(bookmarkStore);
        }
        else if (type === 'editBookmarkNote') {
            void promptEditBookmarkNote(bookmarkStore, msg);
        }
        else if (type === 'openBookmark') {
            deps.onOpenBookmark?.(String(msg.fileUri ?? ''), Number(msg.lineIndex ?? 0));
        }
    });
}
async function confirmDeleteFileBookmarks(store, msg) {
    const filename = String(msg.filename ?? 'this file');
    const answer = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteBookmarksForFile', filename), { modal: true }, (0, l10n_1.t)('action.deleteAll'));
    if (answer === (0, l10n_1.t)('action.deleteAll')) {
        store.removeAllForFile(String(msg.fileUri ?? ''));
    }
}
async function confirmDeleteAllBookmarks(store) {
    const total = store.getTotalCount();
    if (total === 0) {
        return;
    }
    const answer = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteAllBookmarks', String(total), total === 1 ? '' : 's'), { modal: true }, (0, l10n_1.t)('action.deleteAll'));
    if (answer === (0, l10n_1.t)('action.deleteAll')) {
        store.removeAll();
    }
}
async function promptEditBookmarkNote(store, msg) {
    const note = await vscode.window.showInputBox({
        prompt: (0, l10n_1.t)('prompt.editBookmarkNote'),
        value: String(msg.currentNote ?? ''),
    });
    if (note === undefined) {
        return;
    }
    store.updateNote(String(msg.fileUri ?? ''), String(msg.bookmarkId ?? ''), note);
}
//# sourceMappingURL=viewer-handler-bookmarks.js.map