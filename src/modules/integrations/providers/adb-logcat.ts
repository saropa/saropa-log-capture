/**
 * Integration provider for adb logcat: captures Android system log alongside
 * the debug session. Live lines are streamed via onLine callback (set up in
 * session-lifecycle-init); this provider handles header and sidecar at
 * session boundaries.
 */

import { execFileSync } from 'child_process';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { getLogcatBuffer, clearLogcatBuffer, stopLogcatCapture } from '../adb-logcat-capture';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('adbLogcat');
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
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const version = getAdbVersion();
        if (!version) { return undefined; }
        return [{ kind: 'header', lines: [`adb: ${version}`] }];
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }

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
