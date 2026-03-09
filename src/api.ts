/**
 * Runtime implementation of the public extension API.
 *
 * Bridges internal SessionManager listeners and IntegrationRegistry to the
 * standard vscode.Event pattern. Created once during activation; disposed
 * during deactivation.
 */

import * as vscode from 'vscode';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { LineData } from './modules/session/session-event-bus';
import type {
    SaropaLogCaptureApi,
    SaropaLineEvent,
    SaropaSplitEvent,
    SaropaSessionEvent,
    SaropaSessionInfo,
    SaropaIntegrationProvider,
    WriteLineOptions,
} from './api-types';
import { getDefaultIntegrationRegistry } from './modules/integrations';

/** Result of createApi — the public API object plus lifecycle helpers. */
export interface ApiHandle {
    readonly api: SaropaLogCaptureApi;
    readonly fireSessionStart: (event: SaropaSessionEvent) => void;
    readonly fireSessionEnd: (event: SaropaSessionEvent) => void;
    readonly dispose: () => void;
}

/** Create the public API object, wiring it to the given SessionManager. */
export function createApi(sessionManager: SessionManagerImpl): ApiHandle {
    const lineEmitter = new vscode.EventEmitter<SaropaLineEvent>();
    const splitEmitter = new vscode.EventEmitter<SaropaSplitEvent>();
    const startEmitter = new vscode.EventEmitter<SaropaSessionEvent>();
    const endEmitter = new vscode.EventEmitter<SaropaSessionEvent>();

    const lineListener = (data: LineData): void => {
        lineEmitter.fire({
            text: data.text,
            isMarker: data.isMarker,
            lineCount: data.lineCount,
            category: data.category,
            timestamp: data.timestamp,
            sourcePath: data.sourcePath,
            sourceLine: data.sourceLine,
            watchHits: data.watchHits,
        });
    };
    sessionManager.addLineListener(lineListener);

    const splitListener = (
        newUri: vscode.Uri,
        partNumber: number,
        totalParts: number,
    ): void => {
        splitEmitter.fire({ newUri, partNumber, totalParts });
    };
    sessionManager.addSplitListener(splitListener);

    const api: SaropaLogCaptureApi = {
        onDidWriteLine: lineEmitter.event,
        onDidSplitFile: splitEmitter.event,
        onDidStartSession: startEmitter.event,
        onDidEndSession: endEmitter.event,

        getSessionInfo(): SaropaSessionInfo | undefined {
            return buildSessionInfo(sessionManager);
        },

        writeLine(text: string, options?: WriteLineOptions): void {
            sessionManager.writeLine(
                text,
                options?.category ?? 'console',
                options?.timestamp ?? new Date(),
            );
        },

        insertMarker(text?: string): void {
            sessionManager.insertMarker(text);
        },

        registerIntegrationProvider(
            provider: SaropaIntegrationProvider,
        ): vscode.Disposable {
            const registry = getDefaultIntegrationRegistry();
            registry.register(provider);
            return new vscode.Disposable(() => {
                registry.unregister(provider.id);
            });
        },
    };

    return {
        api,
        fireSessionStart: (event) => startEmitter.fire(event),
        fireSessionEnd: (event) => endEmitter.fire(event),
        dispose: () => {
            sessionManager.removeLineListener(lineListener);
            sessionManager.removeSplitListener(splitListener);
            lineEmitter.dispose();
            splitEmitter.dispose();
            startEmitter.dispose();
            endEmitter.dispose();
        },
    };
}

/** Build a read-only session info snapshot from the session manager. */
function buildSessionInfo(
    sessionManager: SessionManagerImpl,
): SaropaSessionInfo | undefined {
    const session = sessionManager.getActiveSession();
    if (!session) {
        if (sessionManager.activeSessionCount > 0) {
            return { isActive: true, isPaused: false, lineCount: 0 };
        }
        return undefined;
    }
    return {
        isActive: true,
        isPaused: session.state === 'paused',
        lineCount: session.lineCount,
        fileUri: session.fileUri,
        debugAdapterType: session.sessionContext.debugAdapterType,
        projectName: session.sessionContext.projectName,
    };
}
