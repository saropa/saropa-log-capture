/**
 * Public API types for Saropa Log Capture.
 *
 * Consuming extensions access the API via:
 * ```typescript
 * const ext = vscode.extensions.getExtension<SaropaLogCaptureApi>('saropa.saropa-log-capture');
 * const api = ext?.isActive ? ext.exports : await ext?.activate();
 * ```
 */

import type * as vscode from 'vscode';

// Re-export integration types under Saropa-prefixed aliases so consumers
// get the same types the internal providers use, without importing internals.
export type {
    IntegrationContext as SaropaIntegrationContext,
    IntegrationEndContext as SaropaIntegrationEndContext,
    Contribution as SaropaContribution,
} from './modules/integrations/types';

/** Data for a single log line emitted during capture. */
export interface SaropaLineEvent {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: Date;
    readonly sourcePath?: string;
    readonly sourceLine?: number;
    readonly watchHits?: readonly string[];
}

/** Data for a file split event. */
export interface SaropaSplitEvent {
    readonly newUri: vscode.Uri;
    readonly partNumber: number;
    readonly totalParts: number;
}

/** Session lifecycle event payload. */
export interface SaropaSessionEvent {
    readonly debugSessionId: string;
    readonly debugAdapterType: string;
    readonly projectName: string;
    readonly fileUri?: vscode.Uri;
}

/** Read-only session info exposed to API consumers. */
export interface SaropaSessionInfo {
    readonly isActive: boolean;
    readonly isPaused: boolean;
    readonly lineCount: number;
    readonly fileUri?: vscode.Uri;
    readonly debugAdapterType?: string;
    readonly projectName?: string;
}

/** Integration provider contract for contributing data to log sessions. */
export interface SaropaIntegrationProvider {
    readonly id: string;
    isEnabled(context: import('./modules/integrations/types').IntegrationContext): boolean | Promise<boolean>;
    onSessionStartSync?(context: import('./modules/integrations/types').IntegrationContext): import('./modules/integrations/types').Contribution[] | undefined;
    onSessionStartAsync?(context: import('./modules/integrations/types').IntegrationContext): Promise<import('./modules/integrations/types').Contribution[] | undefined>;
    onSessionEnd?(context: import('./modules/integrations/types').IntegrationEndContext): Promise<import('./modules/integrations/types').Contribution[] | undefined>;
}

/** Options for {@link SaropaLogCaptureApi.writeLine}. */
export interface WriteLineOptions {
    /**
     * DAP-style category for the line.
     *
     * Standard categories: `'stdout'`, `'stderr'`, `'console'`.
     * Extensions may use custom categories (e.g. `'drift-perf'`).
     * Custom categories appear in the category filter dropdown.
     *
     * @default 'console'
     */
    readonly category?: string;

    /**
     * Override the timestamp for this line.
     *
     * Useful when the event occurred earlier than the write call
     * (e.g. the query finished 200ms ago but was batched).
     *
     * @default new Date()
     */
    readonly timestamp?: Date;
}

/** Public API returned by activate(). */
export interface SaropaLogCaptureApi {
    /** Fires for every line written to the log during capture. */
    readonly onDidWriteLine: vscode.Event<SaropaLineEvent>;

    /** Fires when the log file splits into a new part. */
    readonly onDidSplitFile: vscode.Event<SaropaSplitEvent>;

    /** Fires when a capture session starts. */
    readonly onDidStartSession: vscode.Event<SaropaSessionEvent>;

    /** Fires when a capture session ends. */
    readonly onDidEndSession: vscode.Event<SaropaSessionEvent>;

    /** Get current session info (or undefined if no session is active). */
    getSessionInfo(): SaropaSessionInfo | undefined;

    /**
     * Write a line into the active capture session's log.
     *
     * The line is timestamped, written to the log file, and pushed to the
     * live viewer exactly like a DAP output line. It participates in
     * exclusion rules, flood protection, watch patterns, and all viewer
     * features (search, filtering, export, session replay).
     *
     * No-op if no capture session is active.
     *
     * Newlines are normalized: each `\n` becomes a separate line in the
     * log. Empty strings produce a blank line.
     *
     * @param text - The line text.
     * @param options - Optional metadata for the line.
     */
    writeLine(text: string, options?: WriteLineOptions): void;

    /** Insert a visual marker into the active session's log. */
    insertMarker(text?: string): void;

    /** Register an integration provider. Returns a Disposable to unregister. */
    registerIntegrationProvider(provider: SaropaIntegrationProvider): vscode.Disposable;
}
