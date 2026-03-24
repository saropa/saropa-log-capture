/**
 * Built-in integration provider: pulls Drift Advisor snapshot via extension API
 * (`getSessionSnapshot`) or from `.saropa/drift-advisor-session.json` when the API
 * is missing. Contributes meta key `saropa-drift-advisor` and `{baseFileName}.drift-advisor.json`.
 *
 * When Drift Advisor also registers `saropa-drift-advisor` via registerIntegrationProvider,
 * that provider runs later and overwrites meta/sidecar (last writer wins).
 */

import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { safeParseJSON } from '../../misc/safe-json';
import {
    DRIFT_ADVISOR_EXTENSION_ID,
    DRIFT_ADVISOR_META_KEY,
    DRIFT_ADVISOR_SESSION_FILE_SEGMENTS,
    DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS,
} from '../drift-advisor-constants';
import {
    DRIFT_ADVISOR_CONFIG_SECTION,
    DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY,
    driftBuiltinContributesMetaSidecar,
    normalizeDriftIncludeInLogCaptureSession,
    type DriftAdvisorIncludeInLogCaptureSession,
} from '../drift-advisor-include-level';
import {
    snapshotToMetaPayload,
    snapshotToSidecarObject,
    type DriftAdvisorSnapshotLike,
} from './drift-advisor-snapshot-map';

function adapterOn(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('driftAdvisor');
}

function readDriftIncludeInLogCaptureSession(folder: vscode.WorkspaceFolder): DriftAdvisorIncludeInLogCaptureSession {
    const raw = vscode.workspace
        .getConfiguration(DRIFT_ADVISOR_CONFIG_SECTION, folder.uri)
        .get<unknown>(DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY);
    return normalizeDriftIncludeInLogCaptureSession(raw);
}

function sessionFileUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, ...DRIFT_ADVISOR_SESSION_FILE_SEGMENTS);
}

async function sessionFileExists(folder: vscode.WorkspaceFolder): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(sessionFileUri(folder));
        return true;
    } catch {
        return false;
    }
}

function extensionHasApi(exports: unknown): exports is { getSessionSnapshot: () => Promise<unknown> } {
    if (!exports || typeof exports !== 'object') { return false; }
    const g = (exports as Record<string, unknown>).getSessionSnapshot;
    return typeof g === 'function';
}

async function withTimeoutNull<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
        const t = setTimeout(() => resolve(null), ms);
        p.then((v) => {
            clearTimeout(t);
            resolve(v);
        }).catch(() => {
            clearTimeout(t);
            resolve(null);
        });
    });
}

async function trySnapshotFromExtension(
    outputChannel: vscode.OutputChannel,
): Promise<DriftAdvisorSnapshotLike | null> {
    const ext = vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
    if (!ext) { return null; }
    try {
        // Bound extension activation: even if activation is slow, session-end should not block indefinitely.
        await Promise.race([
            ext.activate(),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS);
            }),
        ]);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[driftAdvisorBuiltin] Drift Advisor activate failed: ${msg}`);
        return null;
    }
    if (!extensionHasApi(ext.exports)) {
        return null;
    }
    const raw = await withTimeoutNull(
        Promise.resolve(ext.exports.getSessionSnapshot()),
        DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS,
    );
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    return raw as DriftAdvisorSnapshotLike;
}

async function trySnapshotFromFile(
    folder: vscode.WorkspaceFolder,
    outputChannel: vscode.OutputChannel,
): Promise<DriftAdvisorSnapshotLike | null> {
    const uri = sessionFileUri(folder);
    try {
        const buf = await vscode.workspace.fs.readFile(uri);
        const parsed = safeParseJSON<DriftAdvisorSnapshotLike>(Buffer.from(buf));
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return parsed;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[driftAdvisorBuiltin] read session file failed: ${msg}`);
        return null;
    }
}

export const driftAdvisorBuiltinProvider: IntegrationProvider = {
    id: 'driftAdvisorBuiltin',

    isEnabled(context: IntegrationContext): boolean | Promise<boolean> {
        if (!adapterOn(context)) {
            return false;
        }
        // Match Drift bridge: only run built-in meta/sidecar path when Drift setting is `full`.
        const includeLevel = readDriftIncludeInLogCaptureSession(context.workspaceFolder);
        if (!driftBuiltinContributesMetaSidecar(includeLevel)) {
            return false;
        }
        const ext = vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
        if (ext) {
            return true;
        }
        return sessionFileExists(context.workspaceFolder);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!adapterOn(context)) {
            return undefined;
        }
        const includeLevel = readDriftIncludeInLogCaptureSession(context.workspaceFolder);
        if (!driftBuiltinContributesMetaSidecar(includeLevel)) {
            return undefined;
        }

        let snap = await trySnapshotFromExtension(context.outputChannel);
        snap ??= await trySnapshotFromFile(context.workspaceFolder, context.outputChannel);
        if (!snap) {
            return undefined;
        }

        const metaPayload = snapshotToMetaPayload(snap);
        const sidecarObj = snapshotToSidecarObject(snap);
        const sidecarName = `${context.baseFileName}.drift-advisor.json`;

        try {
            const contributions: Contribution[] = [
                { kind: 'meta', key: DRIFT_ADVISOR_META_KEY, payload: metaPayload },
                {
                    kind: 'sidecar',
                    filename: sidecarName,
                    content: JSON.stringify(sidecarObj, null, 2),
                    contentType: 'json',
                },
            ];
            return contributions;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[driftAdvisorBuiltin] build contributions failed: ${msg}`);
            return undefined;
        }
    },
};
