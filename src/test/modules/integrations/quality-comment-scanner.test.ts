import * as assert from 'assert';
import {
    countCommentLines,
    countDocumentedExports,
    scanSingleFile,
    isScanSupported,
} from '../../../modules/integrations/providers/quality-comment-scanner';

suite('QualityCommentScanner', () => {

    // --- isScanSupported ---

    test('should support common extensions', () => {
        assert.ok(isScanSupported('ts'));
        assert.ok(isScanSupported('js'));
        assert.ok(isScanSupported('dart'));
        assert.ok(isScanSupported('py'));
        assert.ok(isScanSupported('java'));
        assert.ok(isScanSupported('go'));
    });

    test('should not support unknown extensions', () => {
        assert.ok(!isScanSupported('md'));
        assert.ok(!isScanSupported('json'));
        assert.ok(!isScanSupported('xml'));
    });

    // --- countCommentLines ---

    test('should count JS/TS single-line comments', () => {
        const lines = ['const x = 1;', '// comment', '  // indented comment', 'const y = 2;'];
        assert.strictEqual(countCommentLines(lines, 'ts'), 2);
    });

    test('should count multi-line block comments', () => {
        const lines = ['/* start', ' * middle', ' */ end'];
        assert.strictEqual(countCommentLines(lines, 'js'), 3);
    });

    test('should count single-line block comments', () => {
        const lines = ['/* single block */'];
        assert.strictEqual(countCommentLines(lines, 'ts'), 1);
    });

    test('should count Dart triple-slash doc comments', () => {
        const lines = ['/// Doc comment', '/// Another', 'class Foo {}'];
        assert.strictEqual(countCommentLines(lines, 'dart'), 2);
    });

    test('should count Python hash comments', () => {
        const lines = ['# comment', 'x = 1', '  # another', ''];
        assert.strictEqual(countCommentLines(lines, 'py'), 2);
    });

    test('should skip blank lines', () => {
        const lines = ['', '  ', '// comment', ''];
        assert.strictEqual(countCommentLines(lines, 'ts'), 1);
    });

    // --- countDocumentedExports ---

    test('should detect JSDoc on exported functions', () => {
        const lines = [
            '/** Does something. */',
            'export function doStuff(): void {',
            '}',
            'export function noDoc(): void {',
            '}',
        ];
        const result = countDocumentedExports(lines, 'ts');
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.documented, 1);
    });

    test('should detect JSDoc ending with */ on previous line', () => {
        const lines = [
            '/**',
            ' * Multi-line doc.',
            ' */',
            'export class Foo {',
            '}',
        ];
        const result = countDocumentedExports(lines, 'ts');
        assert.strictEqual(result.total, 1);
        assert.strictEqual(result.documented, 1);
    });

    test('should detect dartdoc on class declarations', () => {
        const lines = [
            '/// A widget.',
            'class MyWidget extends StatelessWidget {',
            '}',
            'class NoDoc {',
            '}',
        ];
        const result = countDocumentedExports(lines, 'dart');
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.documented, 1);
    });

    test('should handle file with no exports', () => {
        const lines = ['const internal = 1;', '// nothing exported'];
        const result = countDocumentedExports(lines, 'ts');
        assert.strictEqual(result.total, 0);
        assert.strictEqual(result.documented, 0);
    });

    test('should handle file where all exports are documented', () => {
        const lines = [
            '/** A */',
            'export function a() {}',
            '/** B */',
            'export const b = 1;',
        ];
        const result = countDocumentedExports(lines, 'ts');
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.documented, 2);
    });

    test('should skip blank lines between doc and export', () => {
        const lines = [
            '/** Doc */',
            '',
            'export function withBlank() {}',
        ];
        const result = countDocumentedExports(lines, 'ts');
        assert.strictEqual(result.total, 1);
        assert.strictEqual(result.documented, 1);
    });

    // --- scanSingleFile ---

    test('should compute correct comment ratio', () => {
        const content = [
            '// comment 1',
            '// comment 2',
            'const x = 1;',
            'const y = 2;',
            'const z = 3;',
            '',
        ].join('\n');
        const data = scanSingleFile(content, 'ts');
        // 2 comment lines / 5 code lines = 0.40
        assert.strictEqual(data.commentRatio, 0.4);
    });

    test('should return zero ratio for empty content', () => {
        const data = scanSingleFile('', 'ts');
        assert.strictEqual(data.commentRatio, 0);
        assert.strictEqual(data.documentedExports, 0);
        assert.strictEqual(data.totalExports, 0);
    });

    test('should handle file with only comments', () => {
        const content = '// line 1\n// line 2\n// line 3\n';
        const data = scanSingleFile(content, 'ts');
        assert.strictEqual(data.commentRatio, 1);
    });
});
