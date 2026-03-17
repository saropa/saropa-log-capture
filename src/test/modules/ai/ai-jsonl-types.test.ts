import * as assert from 'assert';
import { toolNameToCategory, isMutationTool } from '../../../modules/ai/ai-jsonl-types';

suite('AiJsonlTypes', () => {

    suite('toolNameToCategory', () => {
        test('should map Write to ai-edit', () => {
            assert.strictEqual(toolNameToCategory('Write'), 'ai-edit');
        });

        test('should map Edit to ai-edit', () => {
            assert.strictEqual(toolNameToCategory('Edit'), 'ai-edit');
        });

        test('should map NotebookEdit to ai-edit', () => {
            assert.strictEqual(toolNameToCategory('NotebookEdit'), 'ai-edit');
        });

        test('should map Bash to ai-bash', () => {
            assert.strictEqual(toolNameToCategory('Bash'), 'ai-bash');
        });

        test('should map Read to ai-read', () => {
            assert.strictEqual(toolNameToCategory('Read'), 'ai-read');
        });

        test('should map Grep to ai-read', () => {
            assert.strictEqual(toolNameToCategory('Grep'), 'ai-read');
        });

        test('should map Glob to ai-read', () => {
            assert.strictEqual(toolNameToCategory('Glob'), 'ai-read');
        });

        test('should map WebFetch to ai-read', () => {
            assert.strictEqual(toolNameToCategory('WebFetch'), 'ai-read');
        });

        test('should map WebSearch to ai-read', () => {
            assert.strictEqual(toolNameToCategory('WebSearch'), 'ai-read');
        });

        test('should default unknown tools to ai-read', () => {
            assert.strictEqual(toolNameToCategory('SomethingElse'), 'ai-read');
        });
    });

    suite('isMutationTool', () => {
        test('should return true for Write', () => {
            assert.strictEqual(isMutationTool('Write'), true);
        });

        test('should return true for Edit', () => {
            assert.strictEqual(isMutationTool('Edit'), true);
        });

        test('should return true for NotebookEdit', () => {
            assert.strictEqual(isMutationTool('NotebookEdit'), true);
        });

        test('should return true for Bash', () => {
            assert.strictEqual(isMutationTool('Bash'), true);
        });

        test('should return false for Read', () => {
            assert.strictEqual(isMutationTool('Read'), false);
        });

        test('should return false for Grep', () => {
            assert.strictEqual(isMutationTool('Grep'), false);
        });

        test('should return false for unknown tools', () => {
            assert.strictEqual(isMutationTool('Unknown'), false);
        });
    });
});
