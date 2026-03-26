"use strict";
/**
 * Helpers for investigation commands: resolve/pick investigation, format insight payload.
 */
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
exports.formatInsightItemLine = formatInsightItemLine;
exports.resolveOrPickInvestigation = resolveOrPickInvestigation;
exports.promptCreateInvestigation = promptCreateInvestigation;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
function formatInsightItemLine(payload) {
    if (!payload) {
        return '';
    }
    if (payload.type === 'recurring') {
        const text = (payload.exampleLine ?? payload.normalizedText ?? '').trim();
        return text ? `Recurring: ${text}` : '';
    }
    if (payload.type === 'hotfile') {
        const name = (payload.filename ?? '').trim();
        return name ? `Hot file: ${name}` : '';
    }
    return '';
}
/** Resolve the active investigation, or prompt user to pick/create one. Returns undefined if cancelled. */
async function resolveOrPickInvestigation(store) {
    const active = await store.getActiveInvestigation();
    if (active) {
        return active;
    }
    const investigations = await store.listInvestigations();
    let result;
    if (investigations.length === 0) {
        result = await promptCreateInvestigation(store);
    }
    else {
        const items = investigations.map(inv => ({
            label: inv.name,
            investigation: inv,
        }));
        items.push({ label: `$(add) ${(0, l10n_1.t)('action.createNew')}`, investigation: null });
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: (0, l10n_1.t)('prompt.selectInvestigationToAdd'),
        });
        if (!picked) {
            return undefined;
        }
        result = picked.investigation ?? await promptCreateInvestigation(store);
    }
    if (result) {
        await store.setActiveInvestigationId(result.id);
    }
    return result;
}
/** Prompt the user to create a new investigation. Returns undefined if cancelled. */
async function promptCreateInvestigation(store) {
    const name = await vscode.window.showInputBox({
        prompt: (0, l10n_1.t)('prompt.investigationName'),
        placeHolder: (0, l10n_1.t)('placeholder.investigationName'),
    });
    if (!name) {
        return undefined;
    }
    return store.createInvestigation({ name });
}
//# sourceMappingURL=investigation-commands-helpers.js.map