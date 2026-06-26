/**
 * Investigation "view" commands: open a member session, or open the generated overview document
 * that gathers the whole investigation — title, notes, and member sessions with their error /
 * warning counts and notes — into one markdown page so a multi-session effort reads as one thing.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { SessionMetadata } from './ui/session/session-history-grouping';
import type { InvestigationStore } from './modules/session/investigation-store';
import type { Investigation } from './modules/session/investigation-model';
import { buildInvestigationOverview } from './modules/session/investigation-overview';
import {
    flattenLeafSessions,
    buildSessionKeyMap,
    resolveInvestigationMembers,
} from './modules/session/investigation-resolve';
import { pickInvestigation } from './commands-investigations-helpers';

/** Open the investigation overview as an untitled markdown document. */
async function openOverview(
    inv: Investigation,
    members: Parameters<typeof buildInvestigationOverview>[1],
): Promise<void> {
    const content = buildInvestigationOverview(inv, members);
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
    await vscode.window.showTextDocument(doc, { preview: false });
}

/** A QuickPick row that opens either the overview or one resolved session. */
interface OpenPickItem extends vscode.QuickPickItem {
    readonly meta?: SessionMetadata;
}

/**
 * Prompt for an investigation, then offer its overview plus each resolved member session. Picking a
 * session delegates to the existing `openSession` command; picking the overview opens the document.
 */
export async function runOpenInvestigation(
    store: InvestigationStore,
    historyProvider: SessionHistoryProvider,
): Promise<void> {
    const inv = await pickInvestigation(store, t('investigation.pickPlaceholder'));
    if (!inv) { return; }

    const keyMap = buildSessionKeyMap(flattenLeafSessions(await historyProvider.getAllChildren()));
    const resolved = resolveInvestigationMembers(inv, keyMap);
    const members = resolved.map((r) => r.member);

    const overviewRow: OpenPickItem = { label: t('investigation.overviewItemLabel') };
    const sessionRows: OpenPickItem[] = resolved
        .filter((r) => r.meta)
        .map((r) => ({ label: r.member.displayName, description: r.member.note, meta: r.meta }));

    if (sessionRows.length === 0) {
        void vscode.window.showInformationMessage(t('investigation.emptyInvestigation', inv.title));
    }
    const pick = await vscode.window.showQuickPick([overviewRow, ...sessionRows], {
        placeHolder: t('investigation.openPlaceholder', inv.title),
    });
    if (!pick) { return; }
    if (pick.meta) {
        await vscode.commands.executeCommand('saropaLogCapture.openSession', pick.meta);
    } else {
        await openOverview(inv, members);
    }
}
