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
const quality_comment_scanner_1 = require("../../../modules/integrations/providers/quality-comment-scanner");
suite('QualityCommentScanner', () => {
    // --- isScanSupported ---
    test('should support common extensions', () => {
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('ts'));
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('js'));
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('dart'));
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('py'));
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('java'));
        assert.ok((0, quality_comment_scanner_1.isScanSupported)('go'));
    });
    test('should not support unknown extensions', () => {
        assert.ok(!(0, quality_comment_scanner_1.isScanSupported)('md'));
        assert.ok(!(0, quality_comment_scanner_1.isScanSupported)('json'));
        assert.ok(!(0, quality_comment_scanner_1.isScanSupported)('xml'));
    });
    // --- countCommentLines ---
    test('should count JS/TS single-line comments', () => {
        const lines = ['const x = 1;', '// comment', '  // indented comment', 'const y = 2;'];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'ts'), 2);
    });
    test('should count multi-line block comments', () => {
        const lines = ['/* start', ' * middle', ' */ end'];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'js'), 3);
    });
    test('should count single-line block comments', () => {
        const lines = ['/* single block */'];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'ts'), 1);
    });
    test('should count Dart triple-slash doc comments', () => {
        const lines = ['/// Doc comment', '/// Another', 'class Foo {}'];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'dart'), 2);
    });
    test('should count Python hash comments', () => {
        const lines = ['# comment', 'x = 1', '  # another', ''];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'py'), 2);
    });
    test('should skip blank lines', () => {
        const lines = ['', '  ', '// comment', ''];
        assert.strictEqual((0, quality_comment_scanner_1.countCommentLines)(lines, 'ts'), 1);
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
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'ts');
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
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'ts');
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
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'dart');
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.documented, 1);
    });
    test('should handle file with no exports', () => {
        const lines = ['const internal = 1;', '// nothing exported'];
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'ts');
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
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'ts');
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.documented, 2);
    });
    test('should skip blank lines between doc and export', () => {
        const lines = [
            '/** Doc */',
            '',
            'export function withBlank() {}',
        ];
        const result = (0, quality_comment_scanner_1.countDocumentedExports)(lines, 'ts');
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
        const data = (0, quality_comment_scanner_1.scanSingleFile)(content, 'ts');
        // 2 comment lines / 5 code lines = 0.40
        assert.strictEqual(data.commentRatio, 0.4);
    });
    test('should return zero ratio for empty content', () => {
        const data = (0, quality_comment_scanner_1.scanSingleFile)('', 'ts');
        assert.strictEqual(data.commentRatio, 0);
        assert.strictEqual(data.documentedExports, 0);
        assert.strictEqual(data.totalExports, 0);
    });
    test('should handle file with only comments', () => {
        const content = '// line 1\n// line 2\n// line 3\n';
        const data = (0, quality_comment_scanner_1.scanSingleFile)(content, 'ts');
        assert.strictEqual(data.commentRatio, 1);
    });
});
//# sourceMappingURL=quality-comment-scanner.test.js.map