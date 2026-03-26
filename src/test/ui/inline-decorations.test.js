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
const source_linker_1 = require("../../modules/source/source-linker");
suite('InlineDecorations', () => {
    suite('extractSourceReference', () => {
        test('should extract file:line reference', () => {
            const result = (0, source_linker_1.extractSourceReference)('Error at src/main.ts:42');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'src/main.ts');
            assert.strictEqual(result.line, 42);
            assert.strictEqual(result.col, undefined);
        });
        test('should extract file:line:col reference', () => {
            const result = (0, source_linker_1.extractSourceReference)('at module.js:10:5');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'module.js');
            assert.strictEqual(result.line, 10);
            assert.strictEqual(result.col, 5);
        });
        test('should return undefined for no reference', () => {
            const result = (0, source_linker_1.extractSourceReference)('Just a log message');
            assert.strictEqual(result, undefined);
        });
        test('should reject URL port numbers', () => {
            const result = (0, source_linker_1.extractSourceReference)('http://localhost:8080/api');
            assert.strictEqual(result, undefined);
        });
        test('should handle Windows-style paths', () => {
            const result = (0, source_linker_1.extractSourceReference)('at C:/Users/src/app.ts:15');
            assert.ok(result);
            assert.strictEqual(result.line, 15);
        });
        test('should handle various file extensions', () => {
            const extensions = ['ts', 'js', 'dart', 'py', 'go', 'rs', 'java'];
            for (const ext of extensions) {
                const result = (0, source_linker_1.extractSourceReference)(`at file.${ext}:1`);
                assert.ok(result, `Should handle .${ext} files`);
            }
        });
        test('should extract first reference from multiple', () => {
            const result = (0, source_linker_1.extractSourceReference)('Error at src/a.ts:10 and src/b.ts:20');
            assert.ok(result);
            assert.strictEqual(result.filePath, 'src/a.ts');
            assert.strictEqual(result.line, 10);
        });
    });
});
//# sourceMappingURL=inline-decorations.test.js.map