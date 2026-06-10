/**
 * File tailing (live follow) logic for LogViewerProvider.
 * Watches a log file for appended content and feeds new lines into the viewer.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { createTailWatcher, type TailExternalHooks, type LogViewerTailTarget } from "./log-viewer-provider-load";
import { reloadOnExternalChange, warnExternalDelete } from "./log-viewer-provider-external-reload";

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
    target: LogViewerTailTarget;
}

/** Start tailing a log file URI for new content. */
export function startTailing(ts: TailState, opts: StartTailOptions): void {
    stopTailing(ts);
    ts.tailUri = opts.uri;
    ts.tailSessionMidnightMs = opts.sessionMidnightMs;
    // Plan 039b: non-append external changes (truncate/rewrite/delete) are routed through these hooks
    // rather than handled in the watcher, so the reload-vs-warn policy lives in one place.
    const hooks: TailExternalHooks = {
        onExternalReload: (u) => void reloadOnExternalChange(
            opts.target.getCurrentFileUri(), u, (x) => opts.target.loadFromFile(x, { tail: true }),
        ),
        onExternalDelete: (u) => warnExternalDelete(u),
    };
    ts.tailWatcher = createTailWatcher({
        uri: opts.uri,
        sessionMidnightMs: opts.sessionMidnightMs,
        initialLineCount: opts.initialLineCount,
        target: opts.target,
        hooks,
    });
}
