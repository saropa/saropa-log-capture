/**
 * Session stop logic: cleanup maps, build stats, finalizeSession.
 * Extracted to keep session-manager.ts under the line limit.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';
import type { LogSession } from '../capture/log-session';
import type { KeywordWatcher } from '../features/keyword-watcher';
import type { SessionMetadataStore } from './session-metadata';
import type { AutoTagger } from '../misc/auto-tagger';
import type { ProjectIndexer } from '../project-indexer/project-indexer';
import { finalizeSession, buildSessionStats } from './session-lifecycle-finalize';
import type { EarlyOutputBuffer } from './session-event-bus';

export interface StopSessionDeps {
    earlyBuffer: EarlyOutputBuffer;
    childToParentId: Map<string, string>;
    ownerSessionCreatedAt: Map<string, number>;
    bufferingLoggedFor: Set<string>;
    diagnosticWrittenLoggedFor: Set<string>;
    firstBufferTime: Map<string, number>;
    bufferTimeoutWarnedFor: Set<string>;
    sessions: Map<string, LogSession>;
    processIds: Map<string, number>;
    ownerSessionIds: Set<string>;
    sessionStartTime: number;
    categoryCounts: Record<string, number>;
    watcher: KeywordWatcher;
    floodSuppressedTotal: number;
    outputChannel: vscode.OutputChannel;
    statusBar: { hide: () => void };
    metadataStore: SessionMetadataStore;
    autoTagger: AutoTagger | null;
    projectIndexer: ProjectIndexer | null;
}

/** Shape of manager passed to buildStopSessionDeps (keeps session-manager.ts under line limit). */
export interface StopSessionDepsSource extends StopSessionDeps {}

/** Build StopSessionDeps from a manager that has the same shape. */
export function buildStopSessionDeps(manager: StopSessionDepsSource): StopSessionDeps {
    return manager;
}

/**
 * Stop a debug session: cleanup state, build stats, and finalize the log session.
 */
export async function stopSessionImpl(
    session: vscode.DebugSession,
    deps: StopSessionDeps,
): Promise<void> {
    deps.earlyBuffer.delete(session.id);
    deps.childToParentId.delete(session.id);
    deps.ownerSessionCreatedAt.delete(session.id);
    deps.bufferingLoggedFor.delete(session.id);
    deps.diagnosticWrittenLoggedFor.delete(session.id);
    deps.firstBufferTime.delete(session.id);
    deps.bufferTimeoutWarnedFor.delete(session.id);

    const logSession = deps.sessions.get(session.id);
    if (!logSession) { return; }

    deps.sessions.delete(session.id);
    const debugProcessId = deps.processIds.get(session.id);
    deps.processIds.delete(session.id);

    if (!deps.ownerSessionIds.has(session.id)) { return; }
    deps.ownerSessionIds.delete(session.id);

    const stats = buildSessionStats({
        logSession,
        sessionStartTime: deps.sessionStartTime,
        categoryCounts: deps.categoryCounts,
        watcher: deps.watcher,
        floodSuppressedTotal: deps.floodSuppressedTotal,
    });

    const onReportsIndexReady =
        deps.projectIndexer && getConfig().projectIndex.enabled
            ? (logUri: vscode.Uri) => {
                deps.metadataStore.loadMetadata(logUri).then((meta) => {
                    deps.projectIndexer!.upsertReportEntryFromMeta(logUri, meta).catch(() => {});
                }).catch(() => {});
            }
            : undefined;

    await finalizeSession(
        {
            logSession,
            outputChannel: deps.outputChannel,
            autoTagger: deps.autoTagger,
            metadataStore: deps.metadataStore,
            debugAdapterType: session.type,
            sessionStartTime: deps.sessionStartTime,
            debugProcessId,
            onReportsIndexReady,
        },
        stats,
    );

    if (deps.ownerSessionIds.size === 0) {
        deps.statusBar.hide();
    }
}
