/**
 * Helpers for investigation commands: resolve/pick investigation, format signal payload.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { InvestigationStore } from './modules/investigation/investigation-store';
import type { Investigation } from './modules/investigation/investigation-types';

/** Payload from Signals panel "+" (add to case) for any signal type, recurring error, or hot file. */
export type AddSignalItemToCasePayload =
    | { type: 'recurring'; normalizedText?: string; exampleLine?: string }
    | { type: 'hotfile'; filename?: string }
    | { type: 'signal'; kind: string; label: string; detail?: string; fingerprint?: string };

/** Format a case item payload as a single-line summary for the investigation notes. */
export function formatSignalItemLine(payload: AddSignalItemToCasePayload | undefined): string {
    if (!payload) { return ''; }
    if (payload.type === 'recurring') {
        const text = (payload.exampleLine ?? payload.normalizedText ?? '').trim();
        return text ? `Recurring: ${text}` : '';
    }
    if (payload.type === 'hotfile') {
        const name = (payload.filename ?? '').trim();
        return name ? `Hot file: ${name}` : '';
    }
    if (payload.type === 'signal') {
        // Format: "Signal [kind]: label — detail" for unified signal entries
        const kindLabel = payload.kind.charAt(0).toUpperCase() + payload.kind.slice(1);
        const detail = payload.detail ? ` — ${payload.detail.slice(0, 100)}` : '';
        return `Signal [${kindLabel}]: ${payload.label}${detail}`;
    }
    return '';
}

/** Resolve the active investigation, or prompt user to pick/create one. Returns undefined if cancelled. */
export async function resolveOrPickInvestigation(store: InvestigationStore): Promise<Investigation | undefined> {
    const active = await store.getActiveInvestigation();
    if (active) { return active; }

    const investigations = await store.listInvestigations();
    let result: Investigation | undefined;
    if (investigations.length === 0) {
        result = await promptCreateInvestigation(store);
    } else {
        const items: { label: string; investigation: Investigation | null }[] = investigations.map(inv => ({
            label: inv.name,
            investigation: inv,
        }));
        items.push({ label: `$(add) ${t('action.createNew')}`, investigation: null });

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: t('prompt.selectInvestigationToAdd'),
        });
        if (!picked) { return undefined; }
        result = picked.investigation ?? await promptCreateInvestigation(store);
    }
    if (result) { await store.setActiveInvestigationId(result.id); }
    return result;
}

/** Prompt the user to create a new investigation. Returns undefined if cancelled. */
export async function promptCreateInvestigation(store: InvestigationStore): Promise<Investigation | undefined> {
    const name = await vscode.window.showInputBox({
        prompt: t('prompt.investigationName'),
        placeHolder: t('placeholder.investigationName'),
    });
    if (!name) { return undefined; }
    return store.createInvestigation({ name });
}
