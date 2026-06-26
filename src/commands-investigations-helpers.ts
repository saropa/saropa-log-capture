/**
 * Shared UI helpers for the Investigation Groups commands: target-URI resolution (context-menu vs
 * palette), an investigation picker, a "pick or create" picker, and a text prompt. Kept separate so
 * both the CRUD command file and the open/overview command file can use them without a cycle.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { Investigation } from './modules/session/investigation-model';
import type { InvestigationStore } from './modules/session/investigation-store';

/** Extract a Uri from either a bare Uri or a context-menu item `{ uri }`. */
function toUri(arg: unknown): vscode.Uri | undefined {
    if (!arg) { return undefined; }
    if (arg instanceof vscode.Uri) { return arg; }
    const maybe = arg as { uri?: unknown };
    return maybe.uri instanceof vscode.Uri ? maybe.uri : undefined;
}

/**
 * Resolve the command target(s) into log-file URIs. VS Code passes multi-selection as the second
 * argument and the primary item as the first; with neither, fall back to the active editor.
 */
export function resolveTargetUris(primary: unknown, selection: unknown): vscode.Uri[] {
    const uris: vscode.Uri[] = [];
    const seen = new Set<string>();
    const push = (u: vscode.Uri | undefined): void => {
        if (!u) { return; }
        const key = u.toString();
        if (seen.has(key)) { return; }
        seen.add(key);
        uris.push(u);
    };
    if (Array.isArray(selection)) {
        for (const item of selection) { push(toUri(item)); }
    }
    push(toUri(primary));
    if (uris.length === 0) {
        push(vscode.window.activeTextEditor?.document.uri);
    }
    return uris;
}

/** A QuickPick item carrying its investigation (undefined = the "create new" row). */
interface InvestigationPickItem extends vscode.QuickPickItem {
    readonly inv?: Investigation;
}

/** Build a QuickPick row for an investigation, with its session count as the description. */
function investigationItem(inv: Investigation): InvestigationPickItem {
    return {
        label: inv.title,
        description: t('investigation.sessionCount', inv.sessionKeys.length),
        inv,
    };
}

/**
 * Pick an existing investigation. Shows a notice and returns undefined when none exist, so callers
 * never have to special-case the empty state.
 */
export async function pickInvestigation(
    store: InvestigationStore,
    placeHolder: string,
): Promise<Investigation | undefined> {
    const all = store.getAll();
    if (all.length === 0) {
        void vscode.window.showInformationMessage(t('investigation.none'));
        return undefined;
    }
    const pick = await vscode.window.showQuickPick(all.map(investigationItem), { placeHolder });
    return pick?.inv;
}

/** Pick an existing investigation OR create a new one (a "$(add) New investigation…" row on top). */
export async function pickOrCreateInvestigation(
    store: InvestigationStore,
    placeHolder: string,
): Promise<Investigation | undefined> {
    const newRow: InvestigationPickItem = { label: t('investigation.newItemLabel') };
    const items = [newRow, ...store.getAll().map(investigationItem)];
    const pick = await vscode.window.showQuickPick(items, { placeHolder });
    if (!pick) { return undefined; }
    if (pick.inv) { return pick.inv; }
    const title = await promptText({
        prompt: t('investigation.newPrompt'),
        placeHolder: t('investigation.newPlaceholder'),
        requireNonEmpty: true,
        emptyMessage: t('investigation.emptyTitle'),
    });
    return title ? store.create(title) : undefined;
}

/** Options for {@link promptText}. */
interface PromptOptions {
    readonly prompt: string;
    readonly placeHolder?: string;
    readonly value?: string;
    readonly requireNonEmpty?: boolean;
    readonly emptyMessage?: string;
}

/** Show a trimmed InputBox. Returns undefined when cancelled; '' is a valid (e.g. cleared notes). */
export async function promptText(opts: PromptOptions): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
        prompt: opts.prompt,
        placeHolder: opts.placeHolder,
        value: opts.value,
        validateInput: opts.requireNonEmpty
            ? (v) => (v.trim() ? undefined : opts.emptyMessage)
            : undefined,
    });
    return result === undefined ? undefined : result.trim();
}
