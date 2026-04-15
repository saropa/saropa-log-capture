/**
 * Integration provider for adb logcat: captures Android system log alongside
 * the debug session. Streaming lines are spawned via onSessionStartStreaming
 * (Phase 2 provider pattern); header and sidecar are handled at session
 * boundaries.
 */

import { execFileSync } from 'child_process';
import type {
    IntegrationProvider, IntegrationContext, IntegrationEndContext,
    Contribution, StreamingWriter,
} from '../types';
import {
    isAdbAvailable, startLogcatCapture, setLogcatPidFilter,
    getLogcatBuffer, clearLogcatBuffer, stopLogcatCapture,
} from '../adb-logcat-capture';

/**
 * Enabled when explicitly listed in integrations.adapters OR when the
 * debug adapter is Dart/Flutter (auto-detect). The isAdbAvailable() check
 * is deferred to onSessionStartStreaming to avoid spawning a process on
 * every isEnabled call.
 */
function checkEnabled(context: IntegrationContext): boolean {
    const explicit = (context.config.integrationsAdapters ?? []).includes('adbLogcat');
    const autoDetect = context.sessionContext.debugAdapterType === 'dart';
    return explicit || autoDetect;
}

function getAdbVersion(): string | undefined {
    try {
        const out = execFileSync('adb', ['version'], { timeout: 5000, encoding: 'utf-8' });
        const m = /Android Debug Bridge version (\S+)/.exec(out);
        return m?.[1];
    } catch {
        return undefined;
    }
}

export const adbLogcatProvider: IntegrationProvider = {
    id: 'adbLogcat',

    isEnabled(context: IntegrationContext): boolean {
        return checkEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!checkEnabled(context)) { return undefined; }
        const version = getAdbVersion();
        if (!version) { return undefined; }
        return [{ kind: 'header', lines: [`adb: ${version}`] }];
    },

    onSessionStartStreaming(context: IntegrationContext, writer: StreamingWriter): void {
        if (!isAdbAvailable()) { return; }
        const lc = context.config.integrationsAdbLogcat;
        startLogcatCapture({
            ...lc,
            outputChannel: context.outputChannel,
            onLine: (raw) => writer.writeLine(raw, 'logcat', new Date()),
        });
    },

    onProcessId(processId: number): void {
        setLogcatPidFilter(processId);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!checkEnabled(context)) { return undefined; }

        stopLogcatCapture();
        const lines = getLogcatBuffer();
        clearLogcatBuffer();

        const cfg = context.config.integrationsAdbLogcat;
        if (!cfg.writeSidecar || lines.length === 0) { return undefined; }

        const sidecarName = `${context.baseFileName}.logcat.log`;
        return [
            {
                kind: 'meta',
                key: 'adbLogcat',
                payload: { lineCount: lines.length, sidecar: sidecarName },
            },
            {
                kind: 'sidecar',
                filename: sidecarName,
                content: lines.join('\n'),
                contentType: 'utf8',
            },
        ];
    },
};
