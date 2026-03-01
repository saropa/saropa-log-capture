/** Dependencies needed by command registrations. */

import * as vscode from 'vscode';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import type { PopOutPanel } from './ui/viewer-panels/pop-out-panel';

export interface CommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
    readonly popOutPanel: PopOutPanel;
}
