import * as assert from 'assert';
import * as vscode from 'vscode';
import { SearchIndexManager } from '../modules/search-index';

suite('SearchIndexManager', () => {

    test('should initialize with log directory URI', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new SearchIndexManager(uri);
        assert.ok(manager);
    });

    test('should return 0 for total line count when no index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new SearchIndexManager(uri);
        assert.strictEqual(manager.getTotalLineCount(), 0);
    });

    test('should return 0 for total size when no index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new SearchIndexManager(uri);
        assert.strictEqual(manager.getTotalSize(), 0);
    });

    test('should clear cached index', () => {
        const uri = vscode.Uri.file('/test/logs');
        const manager = new SearchIndexManager(uri);
        manager.clear();
        assert.strictEqual(manager.getTotalLineCount(), 0);
    });

    test('should handle non-existent directory gracefully', async () => {
        const uri = vscode.Uri.file('/nonexistent/path/logs');
        const manager = new SearchIndexManager(uri);
        const index = await manager.rebuild();
        assert.strictEqual(index.files.length, 0);
        assert.strictEqual(index.version, 1);
    });
});
