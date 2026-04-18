/**
 * Status bar item that shows the current capture enabled/disabled state
 * and toggles the `saropaLogCapture.enabled` setting on click.
 *
 * Always visible so the user can tell at a glance whether capture is on.
 * Follows the style guide's "one item, one action" principle — this item
 * does nothing except toggle the enabled setting.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

/**
 * A persistent status bar toggle for the `saropaLogCapture.enabled` setting.
 * Shows a filled circle when capture is on, an outline when off.
 * Clicking flips the setting in the current workspace (or globally if no workspace).
 */
export class CaptureToggleStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private enabled: boolean;

    constructor(initialEnabled: boolean) {
        this.enabled = initialEnabled;

        /* Priority 52 puts this to the right of the recording status bar (50)
         * and the pause control (51), keeping capture-related items grouped. */
        this.item = vscode.window.createStatusBarItem(
            'saropaLogCapture.captureToggle',
            vscode.StatusBarAlignment.Right,
            52,
        );
        this.item.name = 'Saropa Log Capture: Toggle';
        this.item.command = 'saropaLogCapture.toggleCapture';
        this.updateAppearance();
        this.item.show();
    }

    /** Update the displayed state (call when the config changes externally). */
    setEnabled(value: boolean): void {
        this.enabled = value;
        this.updateAppearance();
    }

    private updateAppearance(): void {
        if (this.enabled) {
            this.item.text = '$(circle-filled)';
            this.item.tooltip = t('captureToggle.enabledTooltip');
            this.item.color = undefined;
        } else {
            this.item.text = '$(circle-outline)';
            this.item.tooltip = t('captureToggle.disabledTooltip');
            /* Use the warning color so the disabled state stands out. */
            this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
    }

    dispose(): void {
        this.item.dispose();
    }
}
