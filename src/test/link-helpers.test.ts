import * as assert from 'assert';
import {
    parseGitHubRemote, buildVscodeFileUri, buildGitHubFileUrl,
    buildGitHubCommitUrl, buildMarkdownFileLink,
} from '../modules/link-helpers';

suite('parseGitHubRemote', () => {
    test('should parse HTTPS URL', () => {
        assert.strictEqual(parseGitHubRemote('https://github.com/owner/repo'), 'owner/repo');
    });
    test('should parse HTTPS URL with .git suffix', () => {
        assert.strictEqual(parseGitHubRemote('https://github.com/owner/repo.git'), 'owner/repo');
    });
    test('should parse SSH URL', () => {
        assert.strictEqual(parseGitHubRemote('git@github.com:owner/repo.git'), 'owner/repo');
    });
    test('should return undefined for non-GitHub URL', () => {
        assert.strictEqual(parseGitHubRemote('https://gitlab.com/owner/repo'), undefined);
    });
    test('should return undefined for empty string', () => {
        assert.strictEqual(parseGitHubRemote(''), undefined);
    });
});

suite('buildVscodeFileUri', () => {
    test('should build basic URI', () => {
        assert.strictEqual(buildVscodeFileUri('/home/user/file.ts'), 'vscode://file//home/user/file.ts');
    });
    test('should include line number', () => {
        assert.strictEqual(buildVscodeFileUri('/home/user/file.ts', 42), 'vscode://file//home/user/file.ts:42');
    });
    test('should include line and column', () => {
        assert.strictEqual(buildVscodeFileUri('/home/user/file.ts', 42, 10), 'vscode://file//home/user/file.ts:42:10');
    });
    test('should normalize backslashes', () => {
        const result = buildVscodeFileUri('C:\\Users\\dev\\file.ts', 1);
        assert.ok(result.includes('C:/Users/dev/file.ts'));
        assert.ok(!result.includes('\\'));
    });
    test('should skip zero line number', () => {
        assert.strictEqual(buildVscodeFileUri('/file.ts', 0), 'vscode://file//file.ts');
    });
    test('should skip zero column', () => {
        assert.strictEqual(buildVscodeFileUri('/file.ts', 5, 0), 'vscode://file//file.ts:5');
    });
});

suite('buildGitHubFileUrl', () => {
    test('should build blob URL', () => {
        const result = buildGitHubFileUrl('https://github.com/owner/repo', 'main', 'src/file.ts');
        assert.strictEqual(result, 'https://github.com/owner/repo/blob/main/src/file.ts');
    });
    test('should include line anchor', () => {
        const result = buildGitHubFileUrl('https://github.com/owner/repo', 'main', 'src/file.ts', 42);
        assert.strictEqual(result, 'https://github.com/owner/repo/blob/main/src/file.ts#L42');
    });
    test('should strip leading ./ from path', () => {
        const result = buildGitHubFileUrl('https://github.com/o/r', 'main', './lib/foo.dart');
        assert.ok(result?.includes('/blob/main/lib/foo.dart'));
    });
    test('should return undefined for non-GitHub remote', () => {
        assert.strictEqual(buildGitHubFileUrl('https://gitlab.com/o/r', 'main', 'f.ts'), undefined);
    });
    test('should return undefined for empty branch', () => {
        assert.strictEqual(buildGitHubFileUrl('https://github.com/o/r', '', 'f.ts'), undefined);
    });
});

suite('buildGitHubCommitUrl', () => {
    test('should build commit URL', () => {
        const result = buildGitHubCommitUrl('https://github.com/owner/repo', 'abc1234');
        assert.strictEqual(result, 'https://github.com/owner/repo/commit/abc1234');
    });
    test('should return undefined for non-GitHub remote', () => {
        assert.strictEqual(buildGitHubCommitUrl('https://gitlab.com/o/r', 'abc'), undefined);
    });
    test('should return undefined for empty hash', () => {
        assert.strictEqual(buildGitHubCommitUrl('https://github.com/o/r', ''), undefined);
    });
});

suite('buildMarkdownFileLink', () => {
    test('should build vscode:// link with absolute path', () => {
        const result = buildMarkdownFileLink('file.ts:42', '/home/file.ts', 42);
        assert.ok(result.includes('[file.ts:42](vscode://file//home/file.ts:42)'));
    });
    test('should fall back to backticks without absolute path', () => {
        const result = buildMarkdownFileLink('file.ts:42', undefined, 42);
        assert.strictEqual(result, '`file.ts:42`');
    });
    test('should add [GIT] suffix with git context', () => {
        const ctx = { remoteUrl: 'https://github.com/o/r', branch: 'main', relativePath: 'src/file.ts' };
        const result = buildMarkdownFileLink('file.ts:10', '/abs/file.ts', 10, undefined, ctx);
        assert.ok(result.includes('[[GIT]]'));
        assert.ok(result.includes('github.com/o/r/blob/main/src/file.ts#L10'));
    });
    test('should skip [GIT] for non-GitHub remote', () => {
        const ctx = { remoteUrl: 'https://gitlab.com/o/r', branch: 'main', relativePath: 'f.ts' };
        const result = buildMarkdownFileLink('f.ts:1', '/abs/f.ts', 1, undefined, ctx);
        assert.ok(!result.includes('[GIT]'));
    });
});
