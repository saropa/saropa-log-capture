"use strict";
/**
 * UI interactions for session templates.
 * Quick Pick selection and save prompts.
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
exports.pickTemplate = pickTemplate;
exports.promptSaveTemplate = promptSaveTemplate;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const session_templates_1 = require("../session/session-templates");
/** Show Quick Pick to select a template. */
async function pickTemplate() {
    const templates = await (0, session_templates_1.loadTemplates)();
    if (templates.length === 0) {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noTemplates'));
        return undefined;
    }
    const items = templates.map(t => ({
        label: t.name,
        description: t.description,
        detail: buildTemplateDetail(t),
        template: t,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: (0, l10n_1.t)('prompt.selectTemplate'),
        title: 'Session Templates',
    });
    return selected?.template;
}
/** Build detail string for template Quick Pick. */
function buildTemplateDetail(template) {
    const parts = [];
    if (template.watchPatterns?.length) {
        parts.push(`${template.watchPatterns.length} watch patterns`);
    }
    if (template.exclusions?.length) {
        parts.push(`${template.exclusions.length} exclusions`);
    }
    if (template.highlightRules?.length) {
        parts.push(`${template.highlightRules.length} highlight rules`);
    }
    return parts.join(' · ') || 'Empty template';
}
/** Prompt user to save current settings as a template. */
async function promptSaveTemplate() {
    const name = await vscode.window.showInputBox({
        prompt: (0, l10n_1.t)('prompt.templateName'),
        placeHolder: (0, l10n_1.t)('prompt.templateNamePlaceholder'),
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Template name cannot be empty';
            }
            return undefined;
        },
    });
    if (!name) {
        return undefined;
    }
    const description = await vscode.window.showInputBox({
        prompt: (0, l10n_1.t)('prompt.templateDescription'),
        placeHolder: (0, l10n_1.t)('prompt.templateDescriptionPlaceholder'),
    });
    const template = (0, session_templates_1.createTemplateFromSettings)(name.trim(), description?.trim());
    await (0, session_templates_1.saveTemplate)(template);
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.templateSaved', template.name));
    return template;
}
//# sourceMappingURL=session-templates-ui.js.map