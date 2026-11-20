/**
 * Status bar item that shows the current capture enabled/disabled state.
 * Hovering shows a MarkdownString tooltip with command links acting as a menu:
 * toggle capture, open viewer, pause/resume, stop, settings, changelog.
 *
 * Always visible so the user can tell at a glance whether capture is on.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

const trustedCommands = [
    'saropaCapture.toggleCapture',
    'saropaCapture.logViewer.focus',
    'saropaCapture.pause',
    'saropaCapture.stop',
    'saropaCapture.openSettings',
    'saropaCapture.openChangelog',
];

/** One `[icon label](command:id)` markdown link followed by a blank line. */
function cmdLink(icon: string, label: string, commandId: string): string {
    return `[${icon} ${label}](command:${commandId})\n\n`;
}

/**
 * A persistent status bar item for Saropa Capture.
 * Shows "SLC" with a filled/outline circle indicating capture state.
 * When sessions are active, shows the count as a badge (e.g. "SLC (2)").
 * The hover tooltip provides a menu of command links.
 */
export class CaptureToggleStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private enabled: boolean;
    private sessionActive = false;
    private sessionPaused = false;
    private sessionCount = 0;

    constructor(initialEnabled: boolean) {
        this.enabled = initialEnabled;

        /* Priority 52 puts this to the right of the recording status bar (50)
         * and the pause control (51), keeping capture-related items grouped. */
        this.item = vscode.window.createStatusBarItem(
            'saropaCapture.captureToggle',
            vscode.StatusBarAlignment.Right,
            52,
        );
        this.item.name = 'Saropa Capture: Toggle';
        this.item.command = 'saropaCapture.toggleCapture';
        this.updateAppearance();
        this.item.show();
    }

    /** Update the displayed state (call when the config changes externally). */
    setEnabled(value: boolean): void {
        this.enabled = value;
        this.updateAppearance();
    }

    /** Update session state so the tooltip menu can show/hide session items. */
    setSessionState(active: boolean, paused: boolean): void {
        this.sessionActive = active;
        this.sessionPaused = paused;
        this.updateAppearance();
    }

    /** Update the active session count shown as a badge on the label. */
    setSessionCount(count: number): void {
        this.sessionCount = count;
        this.updateAppearance();
    }

    private updateAppearance(): void {
        const icon = this.enabled ? '$(circle-filled)' : '$(circle-outline)';
        const badge = this.sessionCount > 0 ? ` (${this.sessionCount})` : '';
        this.item.text = `${icon} SLC${badge}`;
        this.item.color = this.enabled
            ? undefined
            : new vscode.ThemeColor('statusBarItem.warningForeground');
        this.item.tooltip = this.buildTooltip();
    }

    private buildTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = { enabledCommands: [...trustedCommands] };

        this.appendCaptureLinks(md);
        this.appendSessionLinks(md);
        md.appendMarkdown('---\n\n');
        this.appendUtilityLinks(md);

        return md;
    }

    private appendCaptureLinks(md: vscode.MarkdownString): void {
        const icon = this.enabled ? '$(check)' : '$(circle-outline)';
        const label = this.enabled
            ? t('captureToggle.menu.captureOn')
            : t('captureToggle.menu.captureOff');
        md.appendMarkdown(cmdLink(icon, label, 'saropaCapture.toggleCapture'));
        md.appendMarkdown(cmdLink(
            '$(open-preview)',
            t('captureToggle.menu.openViewer'),
            'saropaCapture.logViewer.focus',
        ));
    }

    private appendSessionLinks(md: vscode.MarkdownString): void {
        if (!this.sessionActive) { return; }
        const pauseIcon = this.sessionPaused
            ? '$(debug-continue)'
            : '$(debug-pause)';
        const pauseLabel = this.sessionPaused
            ? t('captureToggle.menu.resume')
            : t('captureToggle.menu.pause');
        md.appendMarkdown(cmdLink(pauseIcon, pauseLabel, 'saropaCapture.pause'));
        md.appendMarkdown(cmdLink(
            '$(debug-stop)',
            t('captureToggle.menu.stop'),
            'saropaCapture.stop',
        ));
    }

    private appendUtilityLinks(md: vscode.MarkdownString): void {
        md.appendMarkdown(cmdLink(
            '$(gear)',
            t('captureToggle.menu.settings'),
            'saropaCapture.openSettings',
        ));
        md.appendMarkdown(
            `[$(notebook) ${t('captureToggle.menu.changelog')}](command:saropaCapture.openChangelog)`,
        );
    }

    dispose(): void {
        this.item.dispose();
    }
}
