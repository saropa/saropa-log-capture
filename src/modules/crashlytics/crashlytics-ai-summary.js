"use strict";
/** AI-powered crash summary using VS Code Language Model API. */
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
exports.generateCrashSummary = generateCrashSummary;
const vscode = __importStar(require("vscode"));
/** Generate a one-paragraph summary + suggested fix for a crash event. */
async function generateCrashSummary(detail) {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
    if (!cfg.get('enabled', false)) {
        return undefined;
    }
    // Select any available chat model — family names vary by provider
    const models = await Promise.resolve(vscode.lm.selectChatModels()).catch(() => []);
    const model = models[0];
    if (!model) {
        return undefined;
    }
    const prompt = buildPrompt(detail);
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    try {
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        let text = '';
        for await (const chunk of response.text) {
            text += chunk;
            if (text.length > 2000) {
                break;
            }
        }
        return text.trim() || undefined;
    }
    catch {
        return undefined;
    }
}
function buildPrompt(detail) {
    const parts = ['Analyze this mobile app crash and provide a one-paragraph summary followed by a suggested fix.\n'];
    if (detail.crashThread) {
        parts.push(`Exception thread: ${detail.crashThread.name}`);
        const frames = detail.crashThread.frames.slice(0, 15).map(f => f.text).join('\n');
        parts.push(`Stack trace:\n${frames}`);
    }
    if (detail.deviceModel) {
        parts.push(`Device: ${detail.deviceModel}`);
    }
    if (detail.osVersion) {
        parts.push(`OS: Android ${detail.osVersion}`);
    }
    if (detail.customKeys && detail.customKeys.length > 0) {
        parts.push('Custom keys: ' + detail.customKeys.slice(0, 10).map(k => `${k.key}=${k.value}`).join(', '));
    }
    parts.push('\nKeep the response under 200 words. Focus on root cause and actionable fix.');
    return parts.join('\n');
}
//# sourceMappingURL=crashlytics-ai-summary.js.map