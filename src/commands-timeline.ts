/** Command registration for session timeline. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { showTimeline } from './ui/panels/timeline-panel';

/** Register timeline commands. */
export function timelineCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showTimeline',
            async (item?: { uri: vscode.Uri }) => {
                if (item?.uri) { await showTimeline(item.uri); }
                else { vscode.window.showInformationMessage(t('msg.rightClickForTimeline')); }
            },
        ),
    ];
}
