import * as assert from 'assert';
import { isTrackedFile, shouldRedactEnvVar, getFileTypeGlob } from '../modules/config';

suite('Config Module', () => {

    suite('isTrackedFile', () => {
        const defaultTypes = ['.log', '.txt', '.md', '.csv', '.json', '.jsonl', '.html'];

        test('should match .log files', () => {
            assert.strictEqual(isTrackedFile('session.log', defaultTypes), true);
        });

        test('should match .txt files', () => {
            assert.strictEqual(isTrackedFile('output.txt', defaultTypes), true);
        });

        test('should match .json files', () => {
            assert.strictEqual(isTrackedFile('data.json', defaultTypes), true);
        });

        test('should match .jsonl files', () => {
            assert.strictEqual(isTrackedFile('stream.jsonl', defaultTypes), true);
        });

        test('should reject .meta.json sidecar files', () => {
            assert.strictEqual(isTrackedFile('session.meta.json', defaultTypes), false);
        });

        test('should reject dotfiles', () => {
            assert.strictEqual(isTrackedFile('.gitkeep', defaultTypes), false);
            assert.strictEqual(isTrackedFile('.hidden.log', defaultTypes), false);
        });

        test('should reject untracked extensions', () => {
            assert.strictEqual(isTrackedFile('image.png', defaultTypes), false);
            assert.strictEqual(isTrackedFile('archive.zip', defaultTypes), false);
        });

        test('should work with custom file types', () => {
            assert.strictEqual(isTrackedFile('data.xml', ['.xml']), true);
            assert.strictEqual(isTrackedFile('data.xml', ['.json']), false);
        });

        test('should work with empty file types array', () => {
            assert.strictEqual(isTrackedFile('session.log', []), false);
        });

        test('should handle files with multiple dots', () => {
            assert.strictEqual(isTrackedFile('my.session.log', defaultTypes), true);
        });
    });

    suite('shouldRedactEnvVar', () => {

        test('should match exact name (case-insensitive)', () => {
            assert.strictEqual(shouldRedactEnvVar('SECRET_KEY', ['SECRET_KEY']), true);
            assert.strictEqual(shouldRedactEnvVar('secret_key', ['SECRET_KEY']), true);
        });

        test('should match wildcard at end', () => {
            assert.strictEqual(shouldRedactEnvVar('AWS_ACCESS_KEY_ID', ['AWS_*']), true);
            assert.strictEqual(shouldRedactEnvVar('AWS_SECRET', ['AWS_*']), true);
        });

        test('should not match non-matching patterns', () => {
            assert.strictEqual(shouldRedactEnvVar('HOME', ['AWS_*']), false);
            assert.strictEqual(shouldRedactEnvVar('PATH', ['SECRET']), false);
        });

        test('should match wildcard at start', () => {
            assert.strictEqual(shouldRedactEnvVar('DB_PASSWORD', ['*PASSWORD']), true);
            assert.strictEqual(shouldRedactEnvVar('MY_PASSWORD', ['*PASSWORD']), true);
        });

        test('should match wildcard in middle', () => {
            assert.strictEqual(shouldRedactEnvVar('DB_SECRET_KEY', ['DB_*_KEY']), true);
        });

        test('should return false for empty patterns', () => {
            assert.strictEqual(shouldRedactEnvVar('SECRET', []), false);
        });

        test('should match if any pattern matches', () => {
            assert.strictEqual(
                shouldRedactEnvVar('API_KEY', ['SECRET', 'API_*', 'TOKEN']),
                true,
            );
        });

        test('should handle special regex characters in pattern', () => {
            assert.strictEqual(shouldRedactEnvVar('KEY.NAME', ['KEY.NAME']), true);
        });
    });

    suite('getFileTypeGlob', () => {

        test('should produce single-extension glob', () => {
            assert.strictEqual(getFileTypeGlob(['.log']), '*.log');
        });

        test('should produce multi-extension glob with braces', () => {
            assert.strictEqual(getFileTypeGlob(['.log', '.txt']), '*.{log,txt}');
        });

        test('should strip leading dots from extensions', () => {
            const result = getFileTypeGlob(['.log', '.txt', '.md']);
            assert.strictEqual(result, '*.{log,txt,md}');
        });

        test('should handle extensions without leading dot', () => {
            assert.strictEqual(getFileTypeGlob(['log']), '*.log');
        });

        test('should handle mixed dot/no-dot extensions', () => {
            const result = getFileTypeGlob(['.log', 'txt']);
            assert.strictEqual(result, '*.{log,txt}');
        });
    });
});
