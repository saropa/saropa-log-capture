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
const link_helpers_1 = require("../../../modules/source/link-helpers");
suite('parseGitHubRemote', () => {
    test('should parse HTTPS URL', () => {
        assert.strictEqual((0, link_helpers_1.parseGitHubRemote)('https://github.com/owner/repo'), 'owner/repo');
    });
    test('should parse HTTPS URL with .git suffix', () => {
        assert.strictEqual((0, link_helpers_1.parseGitHubRemote)('https://github.com/owner/repo.git'), 'owner/repo');
    });
    test('should parse SSH URL', () => {
        assert.strictEqual((0, link_helpers_1.parseGitHubRemote)('git@github.com:owner/repo.git'), 'owner/repo');
    });
    test('should return undefined for non-GitHub URL', () => {
        assert.strictEqual((0, link_helpers_1.parseGitHubRemote)('https://gitlab.com/owner/repo'), undefined);
    });
    test('should return undefined for empty string', () => {
        assert.strictEqual((0, link_helpers_1.parseGitHubRemote)(''), undefined);
    });
});
suite('buildVscodeFileUri', () => {
    test('should build basic URI', () => {
        assert.strictEqual((0, link_helpers_1.buildVscodeFileUri)('/home/user/file.ts'), 'vscode://file//home/user/file.ts');
    });
    test('should include line number', () => {
        assert.strictEqual((0, link_helpers_1.buildVscodeFileUri)('/home/user/file.ts', 42), 'vscode://file//home/user/file.ts:42');
    });
    test('should include line and column', () => {
        assert.strictEqual((0, link_helpers_1.buildVscodeFileUri)('/home/user/file.ts', 42, 10), 'vscode://file//home/user/file.ts:42:10');
    });
    test('should normalize backslashes', () => {
        const result = (0, link_helpers_1.buildVscodeFileUri)('C:\\Users\\dev\\file.ts', 1);
        assert.ok(result.includes('C:/Users/dev/file.ts'));
        assert.ok(!result.includes('\\'));
    });
    test('should skip zero line number', () => {
        assert.strictEqual((0, link_helpers_1.buildVscodeFileUri)('/file.ts', 0), 'vscode://file//file.ts');
    });
    test('should skip zero column', () => {
        assert.strictEqual((0, link_helpers_1.buildVscodeFileUri)('/file.ts', 5, 0), 'vscode://file//file.ts:5');
    });
});
suite('buildGitHubFileUrl', () => {
    test('should build blob URL', () => {
        const result = (0, link_helpers_1.buildGitHubFileUrl)('https://github.com/owner/repo', 'main', 'src/file.ts');
        assert.strictEqual(result, 'https://github.com/owner/repo/blob/main/src/file.ts');
    });
    test('should include line anchor', () => {
        const result = (0, link_helpers_1.buildGitHubFileUrl)('https://github.com/owner/repo', 'main', 'src/file.ts', 42);
        assert.strictEqual(result, 'https://github.com/owner/repo/blob/main/src/file.ts#L42');
    });
    test('should strip leading ./ from path', () => {
        const result = (0, link_helpers_1.buildGitHubFileUrl)('https://github.com/o/r', 'main', './lib/foo.dart');
        assert.ok(result?.includes('/blob/main/lib/foo.dart'));
    });
    test('should return undefined for non-GitHub remote', () => {
        assert.strictEqual((0, link_helpers_1.buildGitHubFileUrl)('https://gitlab.com/o/r', 'main', 'f.ts'), undefined);
    });
    test('should return undefined for empty branch', () => {
        assert.strictEqual((0, link_helpers_1.buildGitHubFileUrl)('https://github.com/o/r', '', 'f.ts'), undefined);
    });
});
suite('buildGitHubCommitUrl', () => {
    test('should build commit URL', () => {
        const result = (0, link_helpers_1.buildGitHubCommitUrl)('https://github.com/owner/repo', 'abc1234');
        assert.strictEqual(result, 'https://github.com/owner/repo/commit/abc1234');
    });
    test('should return undefined for non-GitHub remote', () => {
        assert.strictEqual((0, link_helpers_1.buildGitHubCommitUrl)('https://gitlab.com/o/r', 'abc'), undefined);
    });
    test('should return undefined for empty hash', () => {
        assert.strictEqual((0, link_helpers_1.buildGitHubCommitUrl)('https://github.com/o/r', ''), undefined);
    });
});
suite('buildMarkdownFileLink', () => {
    test('should build vscode:// link with absolute path', () => {
        const result = (0, link_helpers_1.buildMarkdownFileLink)('file.ts:42', '/home/file.ts', { line: 42 });
        assert.ok(result.includes('[file.ts:42](vscode://file//home/file.ts:42)'));
    });
    test('should fall back to backticks without absolute path', () => {
        const result = (0, link_helpers_1.buildMarkdownFileLink)('file.ts:42', undefined, { line: 42 });
        assert.strictEqual(result, '`file.ts:42`');
    });
    test('should add [GIT] suffix with git context', () => {
        const ctx = { remoteUrl: 'https://github.com/o/r', branch: 'main', relativePath: 'src/file.ts' };
        const result = (0, link_helpers_1.buildMarkdownFileLink)('file.ts:10', '/abs/file.ts', { line: 10, gitContext: ctx });
        assert.ok(result.includes('[[GIT]]'));
        assert.ok(result.includes('github.com/o/r/blob/main/src/file.ts#L10'));
    });
    test('should skip [GIT] for non-GitHub remote', () => {
        const ctx = { remoteUrl: 'https://gitlab.com/o/r', branch: 'main', relativePath: 'f.ts' };
        const result = (0, link_helpers_1.buildMarkdownFileLink)('f.ts:1', '/abs/f.ts', { line: 1, gitContext: ctx });
        assert.ok(!result.includes('[GIT]'));
    });
});
//# sourceMappingURL=link-helpers.test.js.map