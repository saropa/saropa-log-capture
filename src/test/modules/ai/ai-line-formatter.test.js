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
const ai_line_formatter_1 = require("../../../modules/ai/ai-line-formatter");
function makeConfig(overrides) {
    return {
        enabled: true,
        autoDetect: true,
        lookbackMinutes: 30,
        showPrompts: true,
        showReadOperations: true,
        showSystemWarnings: true,
        ...overrides,
    };
}
function makeEntry(type, extra) {
    return {
        type,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        sessionId: 'sess-1',
        ...extra,
    };
}
suite('AiLineFormatter', () => {
    suite('filterAiEntries', () => {
        test('should include all entries when all settings enabled', () => {
            const entries = [
                makeEntry('user-prompt', { promptText: 'hello' }),
                makeEntry('tool-call', { toolCall: { toolName: 'Read', isMutation: false } }),
                makeEntry('system-warning', { systemMessage: 'warn' }),
            ];
            const result = (0, ai_line_formatter_1.filterAiEntries)(entries, makeConfig());
            assert.strictEqual(result.length, 3);
        });
        test('should filter out prompts when showPrompts is false', () => {
            const entries = [
                makeEntry('user-prompt', { promptText: 'hello' }),
                makeEntry('tool-call', { toolCall: { toolName: 'Write', isMutation: true } }),
            ];
            const result = (0, ai_line_formatter_1.filterAiEntries)(entries, makeConfig({ showPrompts: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].type, 'tool-call');
        });
        test('should filter out read tools when showReadOperations is false', () => {
            const entries = [
                makeEntry('tool-call', { toolCall: { toolName: 'Read', isMutation: false } }),
                makeEntry('tool-call', { toolCall: { toolName: 'Grep', isMutation: false } }),
                makeEntry('tool-call', { toolCall: { toolName: 'Write', isMutation: true } }),
            ];
            const result = (0, ai_line_formatter_1.filterAiEntries)(entries, makeConfig({ showReadOperations: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toolCall?.toolName, 'Write');
        });
        test('should filter out system warnings when showSystemWarnings is false', () => {
            const entries = [
                makeEntry('system-warning', { systemMessage: 'Rate limit' }),
                makeEntry('user-prompt', { promptText: 'hello' }),
            ];
            const result = (0, ai_line_formatter_1.filterAiEntries)(entries, makeConfig({ showSystemWarnings: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].type, 'user-prompt');
        });
        test('should return empty array for empty input', () => {
            const result = (0, ai_line_formatter_1.filterAiEntries)([], makeConfig());
            assert.deepStrictEqual(result, []);
        });
    });
    suite('formatAiEntry', () => {
        test('should format user prompt', () => {
            const entry = makeEntry('user-prompt', { promptText: 'Fix the bug' });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('[AI Ask]'));
            assert.ok(line.text.includes('Fix the bug'));
            assert.strictEqual(line.category, 'ai-prompt');
            assert.strictEqual(line.isMarker, false);
        });
        test('should format Write tool call', () => {
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Write', filePath: '/src/app.ts', isMutation: true },
            });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('[AI Write]'));
            assert.ok(line.text.includes('app.ts'));
            assert.strictEqual(line.category, 'ai-edit');
        });
        test('should format Bash tool call with command', () => {
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Bash', command: 'npm test', isMutation: true },
            });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('[AI Bash]'));
            assert.ok(line.text.includes('npm test'));
            assert.strictEqual(line.category, 'ai-bash');
        });
        test('should format system warning', () => {
            const entry = makeEntry('system-warning', { systemMessage: 'Rate limit reached' });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('[AI Warn]'));
            assert.ok(line.text.includes('Rate limit'));
            assert.strictEqual(line.category, 'ai-system');
        });
        test('should truncate long file paths from the left', () => {
            const longPath = '/very/long/path/that/goes/on/and/on/and/on/and/on/and/on/src/deeply/nested/file.ts';
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Read', filePath: longPath, isMutation: false },
            });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('...'));
            assert.ok(line.text.includes('file.ts'));
        });
        test('should truncate long prompts with ellipsis', () => {
            const longPrompt = 'a'.repeat(200);
            const entry = makeEntry('user-prompt', { promptText: longPrompt });
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('...'));
            assert.ok(line.text.length < 200);
        });
        test('should handle tool call without toolCall details', () => {
            const entry = makeEntry('tool-call');
            const line = (0, ai_line_formatter_1.formatAiEntry)(entry);
            assert.ok(line.text.includes('Unknown tool'));
        });
    });
});
//# sourceMappingURL=ai-line-formatter.test.js.map