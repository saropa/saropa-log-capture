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
const ai_jsonl_types_1 = require("../../../modules/ai/ai-jsonl-types");
suite('AiJsonlTypes', () => {
    suite('toolNameToCategory', () => {
        test('should map Write to ai-edit', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Write'), 'ai-edit');
        });
        test('should map Edit to ai-edit', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Edit'), 'ai-edit');
        });
        test('should map NotebookEdit to ai-edit', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('NotebookEdit'), 'ai-edit');
        });
        test('should map Bash to ai-bash', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Bash'), 'ai-bash');
        });
        test('should map Read to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Read'), 'ai-read');
        });
        test('should map Grep to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Grep'), 'ai-read');
        });
        test('should map Glob to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('Glob'), 'ai-read');
        });
        test('should map WebFetch to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('WebFetch'), 'ai-read');
        });
        test('should map WebSearch to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('WebSearch'), 'ai-read');
        });
        test('should default unknown tools to ai-read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.toolNameToCategory)('SomethingElse'), 'ai-read');
        });
    });
    suite('isMutationTool', () => {
        test('should return true for Write', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Write'), true);
        });
        test('should return true for Edit', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Edit'), true);
        });
        test('should return true for NotebookEdit', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('NotebookEdit'), true);
        });
        test('should return true for Bash', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Bash'), true);
        });
        test('should return false for Read', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Read'), false);
        });
        test('should return false for Grep', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Grep'), false);
        });
        test('should return false for unknown tools', () => {
            assert.strictEqual((0, ai_jsonl_types_1.isMutationTool)('Unknown'), false);
        });
    });
});
//# sourceMappingURL=ai-jsonl-types.test.js.map