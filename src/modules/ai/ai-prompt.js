"use strict";
/**
 * Build prompts for AI "Explain this error" using AIContext.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExplainErrorPrompt = buildExplainErrorPrompt;
exports.formatIntegrationData = formatIntegrationData;
function buildExplainErrorPrompt(context) {
    const parts = [
        'You are a debugging assistant. Analyze this error and provide:',
        '1. A brief explanation of what went wrong',
        '2. Likely root cause',
        '3. Suggested fix or next debugging step',
        '',
        `Error occurred in ${context.sessionInfo.debugAdapter} project "${context.sessionInfo.project}".`,
        `Time: ${context.sessionInfo.timestamp}`,
        '',
        'Error line:',
        context.errorLine,
        '',
    ];
    if (context.stackTrace) {
        parts.push('Stack trace:', context.stackTrace, '');
    }
    parts.push('Surrounding log context:', ...context.surroundingLines, '');
    if (context.integrationData) {
        const extra = formatIntegrationData(context.integrationData);
        if (extra) {
            parts.push(extra, '');
        }
    }
    parts.push('Provide a concise, actionable response.');
    return parts.join('\n');
}
function formatIntegrationData(data) {
    const lines = [];
    if (data?.performance) {
        lines.push(`System state: Memory ${data.performance.memory}, CPU ${data.performance.cpu}`);
    }
    if (data?.http?.length) {
        lines.push(`Recent HTTP: ${data.http.map((h) => `${h.url} → ${h.status}`).join(', ')}`);
    }
    if (data?.terminal?.length) {
        lines.push(`Terminal output: ${data.terminal.join(' | ')}`);
    }
    return lines.length > 0 ? `Additional context:\n${lines.join('\n')}` : '';
}
//# sourceMappingURL=ai-prompt.js.map