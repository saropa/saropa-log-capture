import * as assert from 'assert';
import { buildExplainErrorPrompt, formatIntegrationData } from '../../../modules/ai/ai-prompt';
import type { AIContext } from '../../../modules/ai/ai-context-builder';

function minimalContext(overrides?: Partial<AIContext>): AIContext {
    return {
        errorLine: 'NullPointerException: null',
        lineIndex: 42,
        surroundingLines: ['line before', 'line after'],
        sessionInfo: {
            debugAdapter: 'dart',
            project: 'my-app',
            timestamp: '2024-01-15T10:00:00Z',
        },
        ...overrides,
    };
}

suite('AiPrompt', () => {

    suite('buildExplainErrorPrompt', () => {
        test('should include error line', () => {
            const prompt = buildExplainErrorPrompt(minimalContext());
            assert.ok(prompt.includes('NullPointerException: null'));
        });

        test('should include session info', () => {
            const prompt = buildExplainErrorPrompt(minimalContext());
            assert.ok(prompt.includes('dart'));
            assert.ok(prompt.includes('my-app'));
        });

        test('should include surrounding lines', () => {
            const prompt = buildExplainErrorPrompt(minimalContext());
            assert.ok(prompt.includes('line before'));
            assert.ok(prompt.includes('line after'));
        });

        test('should include stack trace when present', () => {
            const prompt = buildExplainErrorPrompt(minimalContext({
                stackTrace: 'at main.dart:10\nat app.dart:20',
            }));
            assert.ok(prompt.includes('Stack trace:'));
            assert.ok(prompt.includes('main.dart:10'));
        });

        test('should omit stack trace section when absent', () => {
            const prompt = buildExplainErrorPrompt(minimalContext());
            assert.ok(!prompt.includes('Stack trace:'));
        });

        test('should include integration data when present', () => {
            const prompt = buildExplainErrorPrompt(minimalContext({
                integrationData: {
                    performance: { memory: '512MB', cpu: '45%' },
                },
            }));
            assert.ok(prompt.includes('512MB'));
            assert.ok(prompt.includes('45%'));
        });

        test('should include actionable instruction', () => {
            const prompt = buildExplainErrorPrompt(minimalContext());
            assert.ok(prompt.includes('concise, actionable'));
        });
    });

    suite('formatIntegrationData', () => {
        test('should return empty string for undefined data', () => {
            assert.strictEqual(formatIntegrationData(undefined), '');
        });

        test('should format performance data', () => {
            const result = formatIntegrationData({
                performance: { memory: '256MB', cpu: '80%' },
            });
            assert.ok(result.includes('Memory 256MB'));
            assert.ok(result.includes('CPU 80%'));
        });

        test('should format HTTP data', () => {
            const result = formatIntegrationData({
                http: [
                    { url: '/api/users', status: 200, duration: 100 },
                    { url: '/api/auth', status: 401, duration: 50 },
                ],
            });
            assert.ok(result.includes('/api/users'));
            assert.ok(result.includes('200'));
            assert.ok(result.includes('401'));
        });

        test('should format terminal data', () => {
            const result = formatIntegrationData({
                terminal: ['npm test failed', 'exit code 1'],
            });
            assert.ok(result.includes('npm test failed'));
            assert.ok(result.includes('exit code 1'));
        });

        test('should combine all sections', () => {
            const result = formatIntegrationData({
                performance: { memory: '1GB', cpu: '10%' },
                http: [{ url: '/health', status: 200, duration: 5 }],
                terminal: ['build ok'],
            });
            assert.ok(result.includes('Additional context:'));
            assert.ok(result.includes('System state'));
            assert.ok(result.includes('Recent HTTP'));
            assert.ok(result.includes('Terminal output'));
        });

        test('should return empty string when all arrays are empty', () => {
            const result = formatIntegrationData({ http: [], terminal: [] });
            assert.strictEqual(result, '');
        });
    });
});
