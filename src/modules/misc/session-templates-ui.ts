/**
 * UI interactions for session templates.
 * Quick Pick selection and save prompts.
 */

import * as vscode from 'vscode';
import {
    SessionTemplate, loadTemplates, saveTemplate, createTemplateFromSettings,
} from '../session/session-templates';

/** Show Quick Pick to select a template. */
export async function pickTemplate(): Promise<SessionTemplate | undefined> {
    const templates = await loadTemplates();
    if (templates.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('msg.noTemplates'));
        return undefined;
    }
    const items = templates.map(t => ({
        label: t.name,
        description: t.description,
        detail: buildTemplateDetail(t),
        template: t,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: vscode.l10n.t('prompt.selectTemplate'),
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
prompt: vscode.l10n.t('prompt.templateName'),
                placeHolder: vscode.l10n.t('prompt.templateNamePlaceholder'),
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
prompt: vscode.l10n.t('prompt.templateDescription'),
                placeHolder: vscode.l10n.t('prompt.templateDescriptionPlaceholder'),
    });
    const template = createTemplateFromSettings(name.trim(), description?.trim());
    await saveTemplate(template);
    vscode.window.showInformationMessage(vscode.l10n.t('msg.templateSaved', template.name));
    return template;
}
