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
const ai_prompt_1 = require("../../../modules/ai/ai-prompt");
function minimalContext(overrides) {
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
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext());
            assert.ok(prompt.includes('NullPointerException: null'));
        });
        test('should include session info', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext());
            assert.ok(prompt.includes('dart'));
            assert.ok(prompt.includes('my-app'));
        });
        test('should include surrounding lines', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext());
            assert.ok(prompt.includes('line before'));
            assert.ok(prompt.includes('line after'));
        });
        test('should include stack trace when present', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext({
                stackTrace: 'at main.dart:10\nat app.dart:20',
            }));
            assert.ok(prompt.includes('Stack trace:'));
            assert.ok(prompt.includes('main.dart:10'));
        });
        test('should omit stack trace section when absent', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext());
            assert.ok(!prompt.includes('Stack trace:'));
        });
        test('should include integration data when present', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext({
                integrationData: {
                    performance: { memory: '512MB', cpu: '45%' },
                },
            }));
            assert.ok(prompt.includes('512MB'));
            assert.ok(prompt.includes('45%'));
        });
        test('should include actionable instruction', () => {
            const prompt = (0, ai_prompt_1.buildExplainErrorPrompt)(minimalContext());
            assert.ok(prompt.includes('concise, actionable'));
        });
    });
    suite('formatIntegrationData', () => {
        test('should return empty string for undefined data', () => {
            assert.strictEqual((0, ai_prompt_1.formatIntegrationData)(undefined), '');
        });
        test('should format performance data', () => {
            const result = (0, ai_prompt_1.formatIntegrationData)({
                performance: { memory: '256MB', cpu: '80%' },
            });
            assert.ok(result.includes('Memory 256MB'));
            assert.ok(result.includes('CPU 80%'));
        });
        test('should format HTTP data', () => {
            const result = (0, ai_prompt_1.formatIntegrationData)({
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
            const result = (0, ai_prompt_1.formatIntegrationData)({
                terminal: ['npm test failed', 'exit code 1'],
            });
            assert.ok(result.includes('npm test failed'));
            assert.ok(result.includes('exit code 1'));
        });
        test('should combine all sections', () => {
            const result = (0, ai_prompt_1.formatIntegrationData)({
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
            const result = (0, ai_prompt_1.formatIntegrationData)({ http: [], terminal: [] });
            assert.strictEqual(result, '');
        });
    });
});
//# sourceMappingURL=ai-prompt.test.js.map