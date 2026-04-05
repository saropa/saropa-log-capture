/**
 * File tailing (live follow) logic for LogViewerProvider.
 * Watches a log file for appended content and feeds new lines into the viewer.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { createTailWatcher } from "./log-viewer-provider-load";

/** Mutable tailing state held by LogViewerProvider. */
export interface TailState {
    tailWatcher: vscode.Disposable | undefined;
    tailLastLineCount: number;
    tailSessionMidnightMs: number;
    tailUri: vscode.Uri | undefined;
    tailUpdateInProgress: boolean;
}

/** Create a fresh (idle) tail state. */
export function createTailState(): TailState {
    return {
        tailWatcher: undefined,
        tailLastLineCount: 0,
        tailSessionMidnightMs: 0,
        tailUri: undefined,
        tailUpdateInProgress: false,
    };
}

/** Stop an active tail watcher and clear its state. */
export function stopTailing(ts: TailState): void {
    ts.tailWatcher?.dispose();
    ts.tailWatcher = undefined;
    ts.tailUri = undefined;
}

/** Options for starting a tail watcher. */
export interface StartTailOptions {
    uri: vscode.Uri;
    sessionMidnightMs: number;
    initialLineCount: number;
    target: Parameters<typeof createTailWatcher>[3];
}

/** Start tailing a log file URI for new content. */
export function startTailing(ts: TailState, opts: StartTailOptions): void {
    stopTailing(ts);
    ts.tailUri = opts.uri;
    ts.tailSessionMidnightMs = opts.sessionMidnightMs;
    ts.tailWatcher = createTailWatcher(opts.uri, opts.sessionMidnightMs, opts.initialLineCount, opts.target);
}
