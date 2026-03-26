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
const assert = __importStar(require("node:assert"));
const vscode = __importStar(require("vscode"));
const vscode_fs_read_directory_safe_1 = require("../../../modules/misc/vscode-fs-read-directory-safe");
suite('readDirectoryIfExistsAsDirectory', () => {
    test('does not call readDirectory when stat throws (missing path — false positive guard)', async () => {
        let readDirectoryCalls = 0;
        const fsApi = {
            stat: async () => {
                throw vscode.FileSystemError.FileNotFound();
            },
            readDirectory: async () => {
                readDirectoryCalls += 1;
                return [];
            },
        };
        const uri = vscode.Uri.file('/tmp/does-not-exist/crashlytics');
        const out = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(fsApi, uri);
        assert.deepStrictEqual(out, []);
        assert.strictEqual(readDirectoryCalls, 0, 'readDirectory must not run when stat fails');
    });
    test('does not call readDirectory when path is a file, not a directory', async () => {
        let readDirectoryCalls = 0;
        const fsApi = {
            stat: async () => ({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => {
                readDirectoryCalls += 1;
                return [['x', vscode.FileType.File]];
            },
        };
        const uri = vscode.Uri.file('/tmp/not-a-dir');
        const out = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(fsApi, uri);
        assert.deepStrictEqual(out, []);
        assert.strictEqual(readDirectoryCalls, 0);
    });
    test('returns readDirectory result when path is a directory', async () => {
        const expected = [
            ['a.json', vscode.FileType.File],
            ['sub', vscode.FileType.Directory],
        ];
        const fsApi = {
            stat: async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => expected,
        };
        const uri = vscode.Uri.file('/tmp/crashlytics');
        const out = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(fsApi, uri);
        assert.deepStrictEqual(out, expected);
    });
    test('returns empty array when readDirectory throws after successful stat (race / permission)', async () => {
        const fsApi = {
            stat: async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
            readDirectory: async () => {
                throw vscode.FileSystemError.NoPermissions();
            },
        };
        const uri = vscode.Uri.file('/tmp/gone');
        const out = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(fsApi, uri);
        assert.deepStrictEqual(out, []);
    });
    test('treats Directory | SymbolicLink bitmask as directory (same as migration checks)', async () => {
        let readDirectoryCalls = 0;
        const fsApi = {
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
        };
        const out = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(fsApi, vscode.Uri.file('/tmp/linkdir'));
        assert.strictEqual(readDirectoryCalls, 1);
        assert.strictEqual(out.length, 1);
    });
});
//# sourceMappingURL=vscode-fs-read-directory-safe.test.js.map