/** Command registration for session timeline. */

import * as vscode from 'vscode';
import { showTimeline } from './ui/timeline-panel';

/** Register timeline commands. */
export function timelineCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'saropaLogCapture.showTimeline',
            async (item?: { uri: vscode.Uri }) => {
                if (item?.uri) { await showTimeline(item.uri); }
                else { vscode.window.showInformationMessage('Right-click a session in Session History to show its timeline.'); }
            },
        ),
    ];
}
