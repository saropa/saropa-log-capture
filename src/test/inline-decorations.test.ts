import * as assert from 'assert';
import { extractSourceReference } from '../modules/source-linker';

suite('InlineDecorations', () => {

    suite('extractSourceReference', () => {
        test('should extract file:line reference', () => {
            const result = extractSourceReference('Error at src/main.ts:42');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'src/main.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.col, undefined);
        });

        test('should extract file:line:col reference', () => {
            const result = extractSourceReference('at module.js:10:5');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'module.js');
            assert.strictEqual(result.line, 10);
            assert.strictEqual(result.col, 5);
        });

        test('should return undefined for no reference', () => {
            const result = extractSourceReference('Just a log message');
            assert.strictEqual(result, undefined);
        });

        test('should reject URL port numbers', () => {
            const result = extractSourceReference('http://localhost:8080/api');
            assert.strictEqual(result, undefined);
        });

        test('should handle Windows-style paths', () => {
            const result = extractSourceReference('at C:/Users/src/app.ts:15');
            assert.ok(result);
            assert.strictEqual(result.line, 15);
        });

        test('should handle various file extensions', () => {
            const extensions = ['ts', 'js', 'dart', 'py', 'go', 'rs', 'java'];
            for (const ext of extensions) {
                const result = extractSourceReference(`at file.${ext}:1`);
                assert.ok(result, `Should handle .${ext} files`);
            }
        });

        test('should extract first reference from multiple', () => {
            const result = extractSourceReference('Error at src/a.ts:10 and src/b.ts:20');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'src/a.ts');
            assert.strictEqual(result.line, 10);
        });
    });
});
