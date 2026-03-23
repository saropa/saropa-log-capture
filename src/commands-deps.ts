/**
 * Dependencies passed to registerCommands. Built in extension-activation and
 * passed to commands.ts; individual command modules (commands-session, commands-export, etc.)
 * receive the same deps for session actions, viewer load, history, and panel access.
 */

import * as vscode from 'vscode';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import type { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import type { InvestigationStore } from './modules/investigation/investigation-store';

export interface CommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
    readonly popOutPanel: PopOutPanel;
    readonly investigationStore: InvestigationStore;
    readonly broadcaster: ViewerBroadcaster;
}
