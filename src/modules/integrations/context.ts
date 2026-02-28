/**
 * Builds IntegrationContext and IntegrationEndContext for the registry.
 */

import * as vscode from 'vscode';
import type { SessionContext } from '../capture/log-session-helpers';
import type { SaropaLogCaptureConfig } from '../config/config';
import type { IntegrationContext, IntegrationEndContext } from './types';

export function createIntegrationContext(
    sessionContext: SessionContext,
    config: SaropaLogCaptureConfig,
    outputChannel: vscode.OutputChannel,
): IntegrationContext {
    return {
        sessionContext,
        workspaceFolder: sessionContext.workspaceFolder,
        config,
        outputChannel,
    };
}

export interface IntegrationEndContextParams {
    base: IntegrationContext;
    logUri: vscode.Uri;
    baseFileName: string;
    sessionStartTime: number;
    sessionEndTime: number;
}

export function createIntegrationEndContext(params: IntegrationEndContextParams): IntegrationEndContext {
    const { base, logUri, baseFileName, sessionStartTime, sessionEndTime } = params;
    const logDirUri = vscode.Uri.joinPath(logUri, '..');
    return {
        ...base,
        logUri,
        baseFileName,
        sessionStartTime,
        sessionEndTime,
        logDirUri,
    };
}
