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
const assert = __importStar(require("assert"));
const bookmark_store_1 = require("../../../modules/storage/bookmark-store");
/** Minimal mock of vscode.ExtensionContext.workspaceState. */
function mockContext() {
    const store = {};
    return {
        workspaceState: {
            get: (_k, d) => store[_k] ?? d,
            update: async (_k, v) => { store[_k] = v; },
        },
    };
}
suite('BookmarkStore', () => {
    test('should add a bookmark', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///test.log', filename: 'test.log', lineIndex: 5, lineText: 'Error line', note: 'my note' });
        const bookmarks = bs.getForFile('file:///test.log');
        assert.strictEqual(bookmarks.length, 1);
        assert.strictEqual(bookmarks[0].lineIndex, 5);
        assert.strictEqual(bookmarks[0].lineText, 'Error line');
        assert.strictEqual(bookmarks[0].note, 'my note');
    });
    test('should add multiple bookmarks to the same file', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'Line 1', note: '' });
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 10, lineText: 'Line 10', note: 'note' });
        assert.strictEqual(bs.getForFile('file:///a.log').length, 2);
        assert.strictEqual(bs.getTotalCount(), 2);
    });
    test('should add bookmarks across multiple files', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'Line', note: '' });
        bs.add({ fileUri: 'file:///b.log', filename: 'b.log', lineIndex: 2, lineText: 'Line', note: '' });
        assert.strictEqual(Object.keys(bs.getAll()).length, 2);
        assert.strictEqual(bs.getTotalCount(), 2);
    });
    test('should remove a single bookmark by id', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'First', note: '' });
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 2, lineText: 'Second', note: '' });
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.remove('file:///a.log', id);
        assert.strictEqual(bs.getForFile('file:///a.log').length, 1);
        assert.strictEqual(bs.getForFile('file:///a.log')[0].lineText, 'Second');
    });
    test('should remove file entry when last bookmark is deleted', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'Only', note: '' });
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.remove('file:///a.log', id);
        assert.strictEqual(bs.getForFile('file:///a.log').length, 0);
        assert.strictEqual(Object.keys(bs.getAll()).length, 0);
    });
    test('should remove all bookmarks for a file', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'One', note: '' });
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 2, lineText: 'Two', note: '' });
        bs.add({ fileUri: 'file:///b.log', filename: 'b.log', lineIndex: 3, lineText: 'Other', note: '' });
        bs.removeAllForFile('file:///a.log');
        assert.strictEqual(bs.getForFile('file:///a.log').length, 0);
        assert.strictEqual(bs.getForFile('file:///b.log').length, 1);
    });
    test('should remove all bookmarks', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'One', note: '' });
        bs.add({ fileUri: 'file:///b.log', filename: 'b.log', lineIndex: 2, lineText: 'Two', note: '' });
        bs.removeAll();
        assert.strictEqual(bs.getTotalCount(), 0);
        assert.strictEqual(Object.keys(bs.getAll()).length, 0);
    });
    test('should update a bookmark note', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'Line', note: 'old note' });
        const id = bs.getForFile('file:///a.log')[0].id;
        bs.updateNote('file:///a.log', id, 'new note');
        assert.strictEqual(bs.getForFile('file:///a.log')[0].note, 'new note');
    });
    test('should truncate long line text', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        const longText = 'A'.repeat(300);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 0, lineText: longText, note: '' });
        const stored = bs.getForFile('file:///a.log')[0];
        assert.ok(stored.lineText.length <= 203); // 200 + '...'
        assert.ok(stored.lineText.endsWith('...'));
    });
    test('should return empty array for unknown file', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        assert.strictEqual(bs.getForFile('file:///nonexistent.log').length, 0);
    });
    test('should generate unique ids', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'A', note: '' });
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 2, lineText: 'B', note: '' });
        const [a, b] = bs.getForFile('file:///a.log');
        assert.notStrictEqual(a.id, b.id);
    });
    test('should be a no-op when removing from nonexistent file', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        bs.remove('file:///nope.log', 'fake-id');
        bs.removeAllForFile('file:///nope.log');
        assert.strictEqual(bs.getTotalCount(), 0);
    });
    test('should fire onDidChange when bookmarks change', () => {
        const ctx = mockContext();
        const bs = new bookmark_store_1.BookmarkStore(ctx);
        let fireCount = 0;
        bs.onDidChange(() => { fireCount++; });
        bs.add({ fileUri: 'file:///a.log', filename: 'a.log', lineIndex: 1, lineText: 'Line', note: '' });
        bs.removeAll();
        assert.strictEqual(fireCount, 2);
    });
    test('Bookmark interface should hold expected fields', () => {
        const b = { id: '1', lineIndex: 0, lineText: 'text', note: '', createdAt: 123 };
        assert.strictEqual(b.id, '1');
        assert.strictEqual(b.lineIndex, 0);
        assert.strictEqual(b.lineText, 'text');
        assert.strictEqual(b.note, '');
        assert.strictEqual(b.createdAt, 123);
    });
    test('FileBookmarks interface should hold expected fields', () => {
        const fb = {
            fileUri: 'file:///a.log',
            filename: 'a.log',
            bookmarks: [],
        };
        assert.strictEqual(fb.fileUri, 'file:///a.log');
        assert.strictEqual(fb.filename, 'a.log');
        assert.strictEqual(fb.bookmarks.length, 0);
    });
});
//# sourceMappingURL=bookmark-store.test.js.map