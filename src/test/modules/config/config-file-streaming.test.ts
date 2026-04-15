/**
 * Tests for readTrackedFilesStreaming — verifies that files are emitted
 * per-directory as soon as each directory is scanned, rather than waiting
 * for the full recursive scan to complete.
 */

import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { readTrackedFiles, readTrackedFilesStreaming } from '../../../modules/config/config';

/** Create a temp directory tree for testing. Returns the root path. */
async function createTempTree(structure: Record<string, string[]>): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-streaming-'));
    for (const [dir, files] of Object.entries(structure)) {
        const dirPath = dir === '.' ? root : path.join(root, dir);
        await fs.mkdir(dirPath, { recursive: true });
        for (const file of files) {
            await fs.writeFile(path.join(dirPath, file), '');
        }
    }
    return root;
}

/** Remove a temp directory tree. */
async function removeTempTree(root: string): Promise<void> {
    await fs.rm(root, { recursive: true, force: true });
}

suite('readTrackedFilesStreaming', () => {
    const fileTypes = ['.log', '.txt'];
    let tmpRoot: string;

    teardown(async () => {
        if (tmpRoot) { await removeTempTree(tmpRoot); }
    });

    test('should return the same files as readTrackedFiles', async () => {
        tmpRoot = await createTempTree({
            '.': ['a.log', 'b.txt', 'c.png'],
            'sub': ['d.log', 'e.txt'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        const streamResult = await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        const normalResult = await readTrackedFiles(uri, fileTypes, true);
        /* Both should find the same files (order may differ within a directory). */
        assert.deepStrictEqual(streamResult.sort(), normalResult.sort());
    });

    test('should call onBatch at least once per directory with files', async () => {
        tmpRoot = await createTempTree({
            '.': ['root.log'],
            'child': ['child.log'],
            'child/grandchild': ['deep.log'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        /* Three directories each have one tracked file — expect at least 3 batches. */
        assert.ok(batches.length >= 3, `Expected >= 3 batches, got ${batches.length}`);
        /* Each batch should contain only files from one directory. */
        assert.deepStrictEqual(batches[0], ['root.log']);
        assert.deepStrictEqual(batches[1], ['child/child.log']);
        assert.deepStrictEqual(batches[2], ['child/grandchild/deep.log']);
    });

    test('should not call onBatch for directories with no tracked files', async () => {
        tmpRoot = await createTempTree({
            '.': ['readme.md'],
            'empty-sub': [],
            'images': ['photo.png'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        /* No .log or .txt files exist — onBatch should never fire. */
        assert.strictEqual(batches.length, 0);
    });

    test('should not recurse when includeSubfolders is false', async () => {
        tmpRoot = await createTempTree({
            '.': ['root.log'],
            'sub': ['sub.log'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        const result = await readTrackedFilesStreaming(uri, fileTypes, false, (files) => {
            batches.push([...files]);
        });
        /* Only root-level file should appear. */
        assert.deepStrictEqual(result, ['root.log']);
        assert.strictEqual(batches.length, 1);
        assert.deepStrictEqual(batches[0], ['root.log']);
    });

    test('should handle empty directory gracefully', async () => {
        tmpRoot = await createTempTree({ '.': [] });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        const result = await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        assert.deepStrictEqual(result, []);
        assert.strictEqual(batches.length, 0);
    });

    test('should handle non-existent directory gracefully', async () => {
        const uri = vscode.Uri.file(path.join(os.tmpdir(), 'saropa-does-not-exist-' + Date.now()));
        const batches: string[][] = [];
        const result = await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        assert.deepStrictEqual(result, []);
        assert.strictEqual(batches.length, 0);
    });

    test('should skip dotfiles and .meta.json sidecars', async () => {
        tmpRoot = await createTempTree({
            '.': ['valid.log', '.hidden.log', 'session.meta.json'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        const result = await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        /* Only valid.log should be returned — dotfiles and .meta.json excluded. */
        assert.deepStrictEqual(result, ['valid.log']);
        assert.strictEqual(batches.length, 1);
        assert.deepStrictEqual(batches[0], ['valid.log']);
    });

    test('should include multiple files from the same directory in one batch', async () => {
        tmpRoot = await createTempTree({
            '.': ['a.log', 'b.log', 'c.txt', 'd.log'],
        });
        const uri = vscode.Uri.file(tmpRoot);
        const batches: string[][] = [];
        await readTrackedFilesStreaming(uri, fileTypes, true, (files) => {
            batches.push([...files]);
        });
        /* All four tracked files in one directory should arrive in a single batch. */
        assert.strictEqual(batches.length, 1);
        assert.strictEqual(batches[0].length, 4);
    });
});
