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
const ai_jsonl_parser_1 = require("../../../modules/ai/ai-jsonl-parser");
suite('AiJsonlParser', () => {
    suite('parseJsonlChunk', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(''), []);
        });
        test('should return empty array for whitespace-only input', () => {
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)('  \n\n  '), []);
        });
        test('should return empty array for invalid JSON lines', () => {
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)('not json'), []);
        });
        test('should parse user prompt entry', () => {
            const line = JSON.stringify({
                type: 'user',
                userType: 'external',
                timestamp: '2024-01-15T10:00:00Z',
                sessionId: 'sess-1',
                message: {
                    content: [{ type: 'text', text: 'Fix the bug' }],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].type, 'user-prompt');
            assert.strictEqual(results[0].promptText, 'Fix the bug');
            assert.strictEqual(results[0].sessionId, 'sess-1');
        });
        test('should skip IDE-injected tags in user prompts', () => {
            const line = JSON.stringify({
                type: 'user',
                userType: 'external',
                sessionId: 'sess-1',
                message: {
                    content: [
                        { type: 'text', text: '<ide_selection>some code</ide_selection>' },
                        { type: 'text', text: 'Real prompt' },
                    ],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].promptText, 'Real prompt');
        });
        test('should skip non-external user entries', () => {
            const line = JSON.stringify({
                type: 'user',
                userType: 'internal',
                sessionId: 'sess-1',
                message: { content: [{ type: 'text', text: 'internal' }] },
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should skip tool_result blocks in user prompts', () => {
            const line = JSON.stringify({
                type: 'user',
                userType: 'external',
                sessionId: 'sess-1',
                message: {
                    content: [{ type: 'text', text: 'tool_result data' }],
                },
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should parse assistant tool call entry', () => {
            const line = JSON.stringify({
                type: 'assistant',
                sessionId: 'sess-1',
                message: {
                    id: 'msg_abc',
                    content: [{
                            type: 'tool_use',
                            name: 'Write',
                            input: { file_path: '/src/app.ts' },
                        }],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].type, 'tool-call');
            assert.strictEqual(results[0].toolCall?.toolName, 'Write');
            assert.strictEqual(results[0].toolCall?.filePath, '/src/app.ts');
            assert.strictEqual(results[0].toolCall?.isMutation, true);
        });
        test('should skip irrelevant tool names', () => {
            const line = JSON.stringify({
                type: 'assistant',
                sessionId: 'sess-1',
                message: {
                    id: 'msg_abc',
                    content: [{
                            type: 'tool_use',
                            name: 'UnknownTool',
                            input: {},
                        }],
                },
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should skip API error messages', () => {
            const line = JSON.stringify({
                type: 'assistant',
                isApiErrorMessage: true,
                sessionId: 'sess-1',
                message: { content: [] },
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should parse system warning entry', () => {
            const line = JSON.stringify({
                type: 'system',
                level: 'warning',
                sessionId: 'sess-1',
                content: 'Rate limit reached',
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].type, 'system-warning');
            assert.strictEqual(results[0].systemMessage, 'Rate limit reached');
        });
        test('should parse system error entry', () => {
            const line = JSON.stringify({
                type: 'system',
                level: 'error',
                sessionId: 'sess-1',
                content: 'Connection lost',
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].type, 'system-warning');
        });
        test('should skip system entries with non-warning/error level', () => {
            const line = JSON.stringify({
                type: 'system',
                level: 'info',
                sessionId: 'sess-1',
                content: 'System started',
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should skip sidechain entries', () => {
            const line = JSON.stringify({
                type: 'assistant',
                isSidechain: true,
                sessionId: 'sess-1',
                message: { content: [] },
            });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should deduplicate streaming assistant messages by message ID', () => {
            const msg1 = JSON.stringify({
                type: 'assistant',
                sessionId: 'sess-1',
                message: {
                    id: 'msg_dup',
                    content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } }],
                },
            });
            const msg2 = JSON.stringify({
                type: 'assistant',
                sessionId: 'sess-1',
                message: {
                    id: 'msg_dup',
                    content: [
                        { type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } },
                        { type: 'tool_use', name: 'Edit', input: { file_path: 'b.ts' } },
                    ],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(`${msg1}\n${msg2}`);
            // Should keep only the last (most complete) version
            assert.strictEqual(results.length, 2); // Read + Edit from msg2
        });
        test('should handle multiple lines of different types', () => {
            const lines = [
                JSON.stringify({
                    type: 'user', userType: 'external', sessionId: 's1',
                    message: { content: [{ type: 'text', text: 'Hello' }] },
                }),
                JSON.stringify({
                    type: 'system', level: 'warning', sessionId: 's1',
                    content: 'Watch out',
                }),
            ].join('\n');
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(lines);
            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].type, 'user-prompt');
            assert.strictEqual(results[1].type, 'system-warning');
        });
        test('should truncate user prompts to 200 chars', () => {
            const longText = 'a'.repeat(300);
            const line = JSON.stringify({
                type: 'user', userType: 'external', sessionId: 's1',
                message: { content: [{ type: 'text', text: longText }] },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.ok(results[0].promptText.length <= 200);
        });
        test('should truncate system messages to 300 chars', () => {
            const longContent = 'x'.repeat(500);
            const line = JSON.stringify({
                type: 'system', level: 'error', sessionId: 's1',
                content: longContent,
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.ok(results[0].systemMessage.length <= 300);
        });
        test('should parse Read tool as non-mutation', () => {
            const line = JSON.stringify({
                type: 'assistant', sessionId: 's1',
                message: {
                    id: 'msg_r',
                    content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'f.ts' } }],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results[0].toolCall?.isMutation, false);
        });
        test('should parse Bash tool as mutation', () => {
            const line = JSON.stringify({
                type: 'assistant', sessionId: 's1',
                message: {
                    id: 'msg_b',
                    content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }],
                },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results[0].toolCall?.toolName, 'Bash');
            assert.strictEqual(results[0].toolCall?.command, 'npm test');
            assert.strictEqual(results[0].toolCall?.isMutation, true);
        });
        test('should preserve gitBranch from entries', () => {
            const line = JSON.stringify({
                type: 'user', userType: 'external', sessionId: 's1',
                gitBranch: 'feature/xyz',
                message: { content: [{ type: 'text', text: 'prompt' }] },
            });
            const results = (0, ai_jsonl_parser_1.parseJsonlChunk)(line);
            assert.strictEqual(results[0].gitBranch, 'feature/xyz');
        });
        test('should skip entries without type field', () => {
            const line = JSON.stringify({ sessionId: 's1', content: 'no type' });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
        test('should skip unknown entry types', () => {
            const line = JSON.stringify({ type: 'unknown', sessionId: 's1' });
            assert.deepStrictEqual((0, ai_jsonl_parser_1.parseJsonlChunk)(line), []);
        });
    });
});
//# sourceMappingURL=ai-jsonl-parser.test.js.map