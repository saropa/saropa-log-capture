import * as assert from 'assert';
import { filterAiEntries, formatAiEntry } from '../../../modules/ai/ai-line-formatter';
import type { AiActivityEntry } from '../../../modules/ai/ai-jsonl-types';
import type { AiActivityConfig } from '../../../modules/config/config';

function makeConfig(overrides?: Partial<AiActivityConfig>): AiActivityConfig {
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

function makeEntry(type: AiActivityEntry['type'], extra?: Partial<AiActivityEntry>): AiActivityEntry {
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
            const entries: AiActivityEntry[] = [
                makeEntry('user-prompt', { promptText: 'hello' }),
                makeEntry('tool-call', { toolCall: { toolName: 'Read', isMutation: false } }),
                makeEntry('system-warning', { systemMessage: 'warn' }),
            ];
            const result = filterAiEntries(entries, makeConfig());
            assert.strictEqual(result.length, 3);
        });

        test('should filter out prompts when showPrompts is false', () => {
            const entries: AiActivityEntry[] = [
                makeEntry('user-prompt', { promptText: 'hello' }),
                makeEntry('tool-call', { toolCall: { toolName: 'Write', isMutation: true } }),
            ];
            const result = filterAiEntries(entries, makeConfig({ showPrompts: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].type, 'tool-call');
        });

        test('should filter out read tools when showReadOperations is false', () => {
            const entries: AiActivityEntry[] = [
                makeEntry('tool-call', { toolCall: { toolName: 'Read', isMutation: false } }),
                makeEntry('tool-call', { toolCall: { toolName: 'Grep', isMutation: false } }),
                makeEntry('tool-call', { toolCall: { toolName: 'Write', isMutation: true } }),
            ];
            const result = filterAiEntries(entries, makeConfig({ showReadOperations: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].toolCall?.toolName, 'Write');
        });

        test('should filter out system warnings when showSystemWarnings is false', () => {
            const entries: AiActivityEntry[] = [
                makeEntry('system-warning', { systemMessage: 'Rate limit' }),
                makeEntry('user-prompt', { promptText: 'hello' }),
            ];
            const result = filterAiEntries(entries, makeConfig({ showSystemWarnings: false }));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].type, 'user-prompt');
        });

        test('should return empty array for empty input', () => {
            const result = filterAiEntries([], makeConfig());
            assert.deepStrictEqual(result, []);
        });
    });

    suite('formatAiEntry', () => {
        test('should format user prompt', () => {
            const entry = makeEntry('user-prompt', { promptText: 'Fix the bug' });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('[AI Ask]'));
            assert.ok(line.text.includes('Fix the bug'));
            assert.strictEqual(line.category, 'ai-prompt');
            assert.strictEqual(line.isMarker, false);
        });

        test('should format Write tool call', () => {
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Write', filePath: '/src/app.ts', isMutation: true },
            });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('[AI Write]'));
            assert.ok(line.text.includes('app.ts'));
            assert.strictEqual(line.category, 'ai-edit');
        });

        test('should format Bash tool call with command', () => {
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Bash', command: 'npm test', isMutation: true },
            });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('[AI Bash]'));
            assert.ok(line.text.includes('npm test'));
            assert.strictEqual(line.category, 'ai-bash');
        });

        test('should format system warning', () => {
            const entry = makeEntry('system-warning', { systemMessage: 'Rate limit reached' });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('[AI Warn]'));
            assert.ok(line.text.includes('Rate limit'));
            assert.strictEqual(line.category, 'ai-system');
        });

        test('should truncate long file paths from the left', () => {
            const longPath = '/very/long/path/that/goes/on/and/on/and/on/and/on/and/on/src/deeply/nested/file.ts';
            const entry = makeEntry('tool-call', {
                toolCall: { toolName: 'Read', filePath: longPath, isMutation: false },
            });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('...'));
            assert.ok(line.text.includes('file.ts'));
        });

        test('should truncate long prompts with ellipsis', () => {
            const longPrompt = 'a'.repeat(200);
            const entry = makeEntry('user-prompt', { promptText: longPrompt });
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('...'));
            assert.ok(line.text.length < 200);
        });

        test('should handle tool call without toolCall details', () => {
            const entry = makeEntry('tool-call');
            const line = formatAiEntry(entry);
            assert.ok(line.text.includes('Unknown tool'));
        });
    });
});
