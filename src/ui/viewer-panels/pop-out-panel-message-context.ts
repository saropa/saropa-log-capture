/**
 * Builds ViewerMessageContext for PopOutPanel message dispatch.
 * Extracted from pop-out-panel.ts to keep the file under the line limit.
 */

import * as vscode from "vscode";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ViewerMessageContext } from "../provider/viewer-message-types";

/** Handler callbacks stored by PopOutPanel. */
export interface PopOutHandlerCallbacks {
    onMarkerRequest?: () => void;
    onLinkClick?: (path: string, line: number, col: number, split: boolean) => void;
    onTogglePause?: () => void;
    onExclusionAdded?: (pattern: string) => void;
    onExclusionRemoved?: (pattern: string) => void;
    onAnnotationPrompt?: (lineIndex: number, current: string) => void;
    onSearchCodebase?: (text: string) => void;
    onSearchSessions?: (text: string) => void;
    onAnalyzeLine?: (text: string, lineIndex: number, fileUri: vscode.Uri | undefined) => void;
    onAddToWatch?: (text: string) => void;
    onPartNavigate?: (part: number) => void;
    onSavePresetRequest?: (filters: Record<string, unknown>) => void;
    onSessionListRequest?: () => void;
    onOpenSessionFromPanel?: (uriString: string) => void;
    onDisplayOptionsChange?: (options: SessionDisplayOptions) => void;
    onAddBookmark?: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void;
    onBookmarkAction?: (msg: Record<string, unknown>) => void;
    onSessionAction?: (action: string, uriStrings: string[], filenames: string[]) => void;
    onBrowseSessionRoot?: () => Promise<void>;
    onClearSessionRoot?: () => Promise<void>;
}

/** Panel state needed for building message context. */
interface PopOutContextSource {
    currentFileUri: vscode.Uri | undefined;
    isSessionActive: boolean;
    context: vscode.ExtensionContext;
    version: string;
    post: (m: unknown) => void;
}

/** Build a ViewerMessageContext from PopOutPanel state and handler callbacks. */
export function buildPopOutMessageContext(
    source: PopOutContextSource,
    handlers: PopOutHandlerCallbacks,
): ViewerMessageContext {
    return {
        currentFileUri: source.currentFileUri,
        isSessionActive: source.isSessionActive,
        context: source.context,
        extensionVersion: source.version,
        post: source.post,
        load: async () => { /* pop-out does not load files */ },
        ...handlers,
    };
}
