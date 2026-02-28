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
}

/** Context passed to providers at session end. */
export interface IntegrationEndContext extends IntegrationContext {
    readonly logUri: vscode.Uri;
    readonly baseFileName: string;
    readonly sessionStartTime: number;
    readonly sessionEndTime: number;
    readonly logDirUri: vscode.Uri;
}

/** Provider contract: contributes data at start (sync/async) and end. */
export interface IntegrationProvider {
    readonly id: string;
    isEnabled(context: IntegrationContext): boolean | Promise<boolean>;
    onSessionStartSync?(context: IntegrationContext): Contribution[] | undefined;
    onSessionStartAsync?(context: IntegrationContext): Promise<Contribution[] | undefined>;
    onSessionEnd?(context: IntegrationEndContext): Promise<Contribution[] | undefined>;
}
