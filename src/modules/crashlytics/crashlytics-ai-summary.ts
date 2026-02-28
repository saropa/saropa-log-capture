/** AI-powered crash summary using VS Code Language Model API. */

import * as vscode from 'vscode';
import type { CrashlyticsEventDetail } from './firebase-crashlytics';

/** Generate a one-paragraph summary + suggested fix for a crash event. */
export async function generateCrashSummary(detail: CrashlyticsEventDetail): Promise<string | undefined> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
    if (!cfg.get<boolean>('enabled', false)) { return undefined; }
    // Select any available chat model — family names vary by provider
    const models = await Promise.resolve(vscode.lm.selectChatModels()).catch(() => []);
    const model = models[0];
    if (!model) { return undefined; }
    const prompt = buildPrompt(detail);
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    try {
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        let text = '';
        for await (const chunk of response.text) { text += chunk; if (text.length > 2000) { break; } }
        return text.trim() || undefined;
    } catch { return undefined; }
}

function buildPrompt(detail: CrashlyticsEventDetail): string {
    const parts = ['Analyze this mobile app crash and provide a one-paragraph summary followed by a suggested fix.\n'];
    if (detail.crashThread) {
        parts.push(`Exception thread: ${detail.crashThread.name}`);
        const frames = detail.crashThread.frames.slice(0, 15).map(f => f.text).join('\n');
        parts.push(`Stack trace:\n${frames}`);
    }
    if (detail.deviceModel) { parts.push(`Device: ${detail.deviceModel}`); }
    if (detail.osVersion) { parts.push(`OS: Android ${detail.osVersion}`); }
    if (detail.customKeys && detail.customKeys.length > 0) {
        parts.push('Custom keys: ' + detail.customKeys.slice(0, 10).map(k => `${k.key}=${k.value}`).join(', '));
    }
    parts.push('\nKeep the response under 200 words. Focus on root cause and actionable fix.');
    return parts.join('\n');
}
