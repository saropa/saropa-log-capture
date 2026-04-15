/**
 * Types for the integration API. Providers contribute header lines, meta, and
 * sidecar files at session start (sync) and session end (async).
 */

import type * as vscode from 'vscode';
import type { SessionContext } from '../capture/log-session-helpers';
import type { SaropaLogCaptureConfig } from '../config/config';

/** Header lines to append to the context header (sync at session start only). */
export interface HeaderContribution {
    readonly kind: 'header';
    readonly lines: readonly string[];
}

/** Meta payload stored under SessionMeta.integrations[key]. */
export interface MetaContribution {
    readonly kind: 'meta';
    readonly key: string;
    readonly payload: unknown;
}

/** Sidecar file written next to the log file (usually at session end). */
export interface SidecarContribution {
    readonly kind: 'sidecar';
    readonly filename: string;
    readonly content: string | Buffer;
    readonly contentType?: 'utf8' | 'json';
}

export type Contribution =
    | HeaderContribution
    | MetaContribution
    | SidecarContribution;

/** Context passed to providers at session start. */
export interface IntegrationContext {
    readonly sessionContext: SessionContext;
    readonly workspaceFolder: vscode.WorkspaceFolder;
    readonly config: SaropaLogCaptureConfig;
    readonly outputChannel: vscode.OutputChannel;
    /** Optional extension context for SecretStorage (e.g. build/CI tokens). */
    readonly extensionContext?: vscode.ExtensionContext;
}

/** Context passed to providers at session end. */
export interface IntegrationEndContext extends IntegrationContext {
    readonly logUri: vscode.Uri;
    readonly baseFileName: string;
    readonly sessionStartTime: number;
    readonly sessionEndTime: number;
    readonly logDirUri: vscode.Uri;
    /** Debug target process ID from DAP process event (if available). */
    readonly debugProcessId?: number;
}

/**
 * Writer interface for streaming providers to push lines into the active
 * log session. Passed to onSessionStartStreaming so providers don't need
 * a direct LogSession reference.
 */
export interface StreamingWriter {
    /** Append a line to the log session. */
    writeLine(text: string, category: string, timestamp?: Date): void;
}

/** Provider contract: contributes data at start (sync/async) and end. */
export interface IntegrationProvider {
    readonly id: string;
    isEnabled(context: IntegrationContext): boolean | Promise<boolean>;
    onSessionStartSync?(context: IntegrationContext): Contribution[] | undefined;
    onSessionStartAsync?(context: IntegrationContext): Promise<Contribution[] | undefined>;
    /**
     * Begin streaming lines into the log session. Called after session.start()
     * for providers that spawn long-running child processes (e.g. adb logcat).
     * The provider pushes lines via writer.writeLine(); the registry handles
     * the isEnabled gate.
     */
    onSessionStartStreaming?(context: IntegrationContext, writer: StreamingWriter): void;
    /**
     * Called when a DAP process event delivers the debug target's system PID.
     * Streaming providers that filter by PID (e.g. adb logcat) use this to
     * narrow their output.
     */
    onProcessId?(processId: number): void;
    onSessionEnd?(context: IntegrationEndContext): Promise<Contribution[] | undefined>;
}
