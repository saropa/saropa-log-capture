import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { readDirectoryIfExistsAsDirectory } from '../../../modules/misc/vscode-fs-read-directory-safe';

suite('readDirectoryIfExistsAsDirectory', () => {
    test('does not call readDirectory when stat throws (missing path — false positive guard)', async () => {
        let readDirectoryCalls = 0;
        const fsApi: vscode.FileSystem = {
            stat: async () => {
                throw vscode.FileSystemError.FileNotFound();
            },
            readDirectory: async () => {
                readDirectoryCalls += 1;
                return [];
            },
        } as unknown as vscode.FileSystem;
        const uri = vscode.Uri.file('/tmp/does-not-exist/crashlytics');
        const out = await readDirectoryIfExistsAsDirectory(fsApi, uri);
        assert.deepStrictEqual(out, []);
        assert.strictEqual(readDirectoryCalls, 0, 'readDirectory must not run when stat fails');
    });

    test('does not call readDirectory when path is a file, not a directory', async () => {
        let readDirectoryCalls = 0;
        const fsApi: vscode.FileSystem = {
            stat: async () => ({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => {
                readDirectoryCalls += 1;
                return [['x', vscode.FileType.File]];
            },
        } as unknown as vscode.FileSystem;
        const uri = vscode.Uri.file('/tmp/not-a-dir');
        const out = await readDirectoryIfExistsAsDirectory(fsApi, uri);
        assert.deepStrictEqual(out, []);
        assert.strictEqual(readDirectoryCalls, 0);
    });

    test('returns readDirectory result when path is a directory', async () => {
        const expected: [string, vscode.FileType][] = [
            ['a.json', vscode.FileType.File],
            ['sub', vscode.FileType.Directory],
        ];
        const fsApi: vscode.FileSystem = {
            stat: async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => expected,
        } as unknown as vscode.FileSystem;
        const uri = vscode.Uri.file('/tmp/crashlytics');
        const out = await readDirectoryIfExistsAsDirectory(fsApi, uri);
        assert.deepStrictEqual(out, expected);
    });

    test('returns empty array when readDirectory throws after successful stat (race / permission)', async () => {
        const fsApi: vscode.FileSystem = {
            stat: async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => {
                throw vscode.FileSystemError.NoPermissions();
            },
        } as unknown as vscode.FileSystem;
        const uri = vscode.Uri.file('/tmp/gone');
        const out = await readDirectoryIfExistsAsDirectory(fsApi, uri);
        assert.deepStrictEqual(out, []);
    });

    test('treats Directory | SymbolicLink bitmask as directory (same as migration checks)', async () => {
        let readDirectoryCalls = 0;
        const fsApi: vscode.FileSystem = {
            stat: async () => ({
                type: vscode.FileType.Directory | vscode.FileType.SymbolicLink,
                ctime: 0,
                mtime: 0,
                size: 0,
            }),
            readDirectory: async () => {
                readDirectoryCalls += 1;
                return [['f.json', vscode.FileType.File]];
            },
        } as unknown as vscode.FileSystem;
        const out = await readDirectoryIfExistsAsDirectory(fsApi, vscode.Uri.file('/tmp/linkdir'));
        assert.strictEqual(readDirectoryCalls, 1);
        assert.strictEqual(out.length, 1);
    });
});
