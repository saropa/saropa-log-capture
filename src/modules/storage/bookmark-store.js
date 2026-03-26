"use strict";
/**
 * Bookmark persistence layer backed by workspaceState. Used by viewer-handler-wiring
 * (add, remove, list) and by activation to push bookmark list to the broadcaster on change.
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
exports.BookmarkStore = void 0;
const vscode = __importStar(require("vscode"));
const BOOKMARKS_KEY = 'slc.bookmarks';
const MAX_LINE_TEXT = 200;
let idCounter = 0;
/** CRUD operations for bookmarks, persisted via workspaceState. */
class BookmarkStore {
    context;
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    constructor(context) {
        this.context = context;
    }
    dispose() { this._onDidChange.dispose(); }
    /** Add a bookmark for a line in the given file. */
    add(input) {
        const { fileUri, filename, lineIndex, lineText, note } = input;
        const map = this.load();
        const entry = map[fileUri] ?? { fileUri, filename, bookmarks: [] };
        const trimmed = lineText.length > MAX_LINE_TEXT ? lineText.slice(0, MAX_LINE_TEXT) + '...' : lineText;
        const newBookmark = {
            id: `${Date.now()}-${++idCounter}`,
            lineIndex,
            lineText: trimmed,
            note,
            createdAt: Date.now(),
        };
        map[fileUri] = { ...entry, bookmarks: [...entry.bookmarks, newBookmark] };
        this.save(map);
    }
    /** Remove a single bookmark by id. */
    remove(fileUri, bookmarkId) {
        const map = this.load();
        const entry = map[fileUri];
        if (!entry) {
            return;
        }
        const filtered = entry.bookmarks.filter(b => b.id !== bookmarkId);
        if (filtered.length === 0) {
            delete map[fileUri];
        }
        else {
            map[fileUri] = { ...entry, bookmarks: filtered };
        }
        this.save(map);
    }
    /** Update the note on an existing bookmark. */
    updateNote(fileUri, bookmarkId, note) {
        const map = this.load();
        const entry = map[fileUri];
        if (!entry) {
            return;
        }
        map[fileUri] = {
            ...entry,
            bookmarks: entry.bookmarks.map(b => b.id === bookmarkId ? { ...b, note } : b),
        };
        this.save(map);
    }
    /** Remove all bookmarks for one file. */
    removeAllForFile(fileUri) {
        const map = this.load();
        if (!map[fileUri]) {
            return;
        }
        delete map[fileUri];
        this.save(map);
    }
    /** Remove every bookmark. */
    removeAll() { this.save({}); }
    /** Get bookmarks for a single file (empty array if none). */
    getForFile(fileUri) {
        return this.load()[fileUri]?.bookmarks ?? [];
    }
    /** Get all file bookmark entries. */
    getAll() { return this.load(); }
    /** Total bookmark count across all files. */
    getTotalCount() {
        const map = this.load();
        let total = 0;
        for (const key of Object.keys(map)) {
            total += map[key].bookmarks.length;
        }
        return total;
    }
    load() {
        return this.context.workspaceState.get(BOOKMARKS_KEY, {});
    }
    save(map) {
        void this.context.workspaceState.update(BOOKMARKS_KEY, map);
        this._onDidChange.fire();
    }
}
exports.BookmarkStore = BookmarkStore;
//# sourceMappingURL=bookmark-store.js.map