/**
 * UI interactions for session templates.
 * Quick Pick selection and save prompts.
 */

import * as vscode from 'vscode';
import {
    SessionTemplate, loadTemplates, saveTemplate, createTemplateFromSettings,
} from './session-templates';

/** Show Quick Pick to select a template. */
export async function pickTemplate(): Promise<SessionTemplate | undefined> {
    const templates = await loadTemplates();
    if (templates.length === 0) {
        vscode.window.showInformationMessage('No templates available.');
        return undefined;
    }
    const items = templates.map(t => ({
        label: t.name,
        description: t.description,
        detail: buildTemplateDetail(t),
        template: t,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a template to apply',
        title: 'Session Templates',
    });
    return selected?.template;
}

/** Build detail string for template Quick Pick. */
function buildTemplateDetail(template: SessionTemplate): string {
    const parts: string[] = [];
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
export async function promptSaveTemplate(): Promise<SessionTemplate | undefined> {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter a name for this template',
        placeHolder: 'e.g., My Flutter Setup, API Debug',
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
        prompt: 'Enter a description (optional)',
        placeHolder: 'e.g., Optimized for REST API debugging',
    });
    const template = createTemplateFromSettings(name.trim(), description?.trim());
    await saveTemplate(template);
    vscode.window.showInformationMessage(`Template "${template.name}" saved.`);
    return template;
}
