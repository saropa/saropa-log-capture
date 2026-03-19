/**
 * Types for the viewer message dispatch system.
 * Extracted to keep viewer-message-handler.ts under the line limit.
 */

import * as vscode from "vscode";
import type { SessionDisplayOptions } from '../session/session-display';

export interface ViewerMessageContext {
    readonly currentFileUri: vscode.Uri | undefined;
    readonly isSessionActive: boolean;
    readonly context: vscode.ExtensionContext;
    readonly extensionVersion?: string;
    readonly post: (msg: unknown) => void;
    readonly load: (uri: vscode.Uri) => Promise<void>;
    readonly onMarkerRequest?: () => void;
    readonly onTogglePause?: () => void;
    readonly onExclusionAdded?: (p: string) => void;
    readonly onExclusionRemoved?: (p: string) => void;
    readonly onAnnotationPrompt?: (i: number, c: string) => void;
    readonly onSearchCodebase?: (t: string) => void;
    readonly onSearchSessions?: (t: string) => void;
    readonly onAnalyzeLine?: (t: string, i: number, u: vscode.Uri | undefined) => void;
    readonly onAddToWatch?: (t: string) => void;
    readonly onLinkClick?: (p: string, l: number, c: number, s: boolean) => void;
    readonly onPartNavigate?: (p: number) => void;
    readonly onSavePresetRequest?: (f: Record<string, unknown>) => void;
    readonly onSessionListRequest?: () => void;
    readonly onOpenSessionFromPanel?: (u: string) => void;
    readonly onDisplayOptionsChange?: (o: SessionDisplayOptions) => void;
    readonly onPopOutRequest?: () => void;
    readonly onOpenInsightTabRequest?: () => void;
    readonly onRevealLogFile?: (u: string) => void;
    readonly onAddBookmark?: (i: number, t: string, u: vscode.Uri | undefined) => void;
    readonly onFindInFiles?: (q: string, o: Record<string, unknown>) => void;
    readonly onOpenFindResult?: (u: string, q: string, o: Record<string, unknown>) => void;
    readonly onFindNavigateMatch?: (u: string, i: number) => void;
    readonly onBookmarkAction?: (m: Record<string, unknown>) => void;
    readonly onSessionNavigate?: (d: number) => void;
    readonly onSessionAction?: (a: string, uriStrings: string[], filenames: string[]) => void;
    readonly onBrowseSessionRoot?: () => Promise<void>;
    readonly onClearSessionRoot?: () => Promise<void>;
}
