import * as assert from 'assert';
import { parseEslintJson } from '../../../modules/integrations/providers/quality-lint-reader';

suite('QualityLintReader', () => {

    const makeEntry = (filePath: string, messages: { severity: number; message: string }[]) =>
        ({ filePath, messages });

    // --- Basic parsing ---

    test('should parse ESLint JSON with multiple files', () => {
        const refs = new Set(['src/foo.ts', 'src/bar.ts']);
        const json = JSON.stringify([
            makeEntry('src/foo.ts', [
                { severity: 1, message: 'no-unused-vars' },
                { severity: 2, message: 'no-undef' },
            ]),
            makeEntry('src/bar.ts', [
                { severity: 1, message: 'semi' },
            ]),
        ]);
        const result = parseEslintJson(json, refs);
        assert.strictEqual(result.size, 2);
        const foo = result.get('src/foo.ts');
        assert.strictEqual(foo?.warnings, 1);
        assert.strictEqual(foo?.errors, 1);
        const bar = result.get('src/bar.ts');
        assert.strictEqual(bar?.warnings, 1);
        assert.strictEqual(bar?.errors, 0);
    });

    test('should filter to only referenced files', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            makeEntry('src/foo.ts', [{ severity: 1, message: 'warn' }]),
            makeEntry('src/ignored.ts', [{ severity: 2, message: 'err' }]),
        ]);
        const result = parseEslintJson(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/foo.ts'));
    });

    test('should count severity 1 as warning and severity 2 as error', () => {
        const refs = new Set(['src/app.ts']);
        const json = JSON.stringify([
            makeEntry('src/app.ts', [
                { severity: 1, message: 'a' },
                { severity: 1, message: 'b' },
                { severity: 2, message: 'c' },
                { severity: 2, message: 'd' },
                { severity: 2, message: 'e' },
            ]),
        ]);
        const result = parseEslintJson(json, refs);
        const data = result.get('src/app.ts');
        assert.strictEqual(data?.warnings, 2);
        assert.strictEqual(data?.errors, 3);
    });

    test('should extract top 3 messages only', () => {
        const refs = new Set(['src/app.ts']);
        const messages = Array.from({ length: 5 }, (_, i) => ({ severity: 1, message: `msg-${i}` }));
        const json = JSON.stringify([makeEntry('src/app.ts', messages)]);
        const result = parseEslintJson(json, refs);
        const data = result.get('src/app.ts');
        assert.strictEqual(data?.topMessages.length, 3);
        assert.deepStrictEqual([...data!.topMessages], ['msg-0', 'msg-1', 'msg-2']);
    });

    // --- Edge cases ---

    test('should handle empty messages array', () => {
        const refs = new Set(['src/empty.ts']);
        const json = JSON.stringify([makeEntry('src/empty.ts', [])]);
        const result = parseEslintJson(json, refs);
        const data = result.get('src/empty.ts');
        assert.strictEqual(data?.warnings, 0);
        assert.strictEqual(data?.errors, 0);
        assert.strictEqual(data?.topMessages.length, 0);
    });

    test('should return empty map for invalid JSON', () => {
        const result = parseEslintJson('not valid json', new Set(['anything']));
        assert.strictEqual(result.size, 0);
    });

    test('should return empty map for non-array JSON', () => {
        const result = parseEslintJson('{"key": "value"}', new Set(['anything']));
        assert.strictEqual(result.size, 0);
    });

    test('should return empty map when no referenced files match', () => {
        const json = JSON.stringify([
            makeEntry('src/other.ts', [{ severity: 1, message: 'warn' }]),
        ]);
        const result = parseEslintJson(json, new Set(['src/mine.ts']));
        assert.strictEqual(result.size, 0);
    });

    // --- Path normalization ---

    test('should match files with suffix path matching', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            makeEntry('/home/user/project/src/foo.ts', [
                { severity: 1, message: 'warn' },
            ]),
        ]);
        const result = parseEslintJson(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/foo.ts'));
    });

    test('should normalize Windows backslash paths', () => {
        const refs = new Set(['src/bar.ts']);
        const json = JSON.stringify([
            makeEntry('C:\\Users\\dev\\src\\bar.ts', [
                { severity: 2, message: 'error' },
            ]),
        ]);
        const result = parseEslintJson(json, refs);
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('src/bar.ts'));
    });

    test('should skip entries with missing filePath or messages', () => {
        const refs = new Set(['src/foo.ts']);
        const json = JSON.stringify([
            { messages: [{ severity: 1, message: 'x' }] },
            { filePath: 'src/foo.ts' },
            makeEntry('src/foo.ts', [{ severity: 1, message: 'valid' }]),
        ]);
        const result = parseEslintJson(json, refs);
        assert.strictEqual(result.size, 1);
        assert.strictEqual(result.get('src/foo.ts')?.warnings, 1);
    });
});
