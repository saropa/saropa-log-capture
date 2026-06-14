/**
 * A dedicated status-bar item shown while external log files are being tailed
 * during a session ("Tailing N logs"). Separate from the main recording status
 * item so it can appear/disappear independently as tailers attach/detach. The
 * external-log tailer drives it via its active-count callback.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

let item: vscode.StatusBarItem | undefined;

/** Show/update the indicator for `count` tailed files; hide it at zero. */
export function updateExternalLogTailStatus(count: number): void {
    if (count <= 0) {
        item?.hide();
        return;
    }
    if (!item) {
        item = vscode.window.createStatusBarItem(
            'saropaLogCapture.externalLogTail',
            vscode.StatusBarAlignment.Right,
            49,
        );
        item.name = 'Saropa Log Capture: External Logs';
    }
    item.text = `$(file) ${t('statusBar.tailingLogs', count)}`;
    item.tooltip = t('statusBar.tailingLogsTooltip');
    item.show();
}

/** Dispose the indicator (call when the session ends). */
export function disposeExternalLogTailStatus(): void {
    item?.dispose();
    item = undefined;
}
