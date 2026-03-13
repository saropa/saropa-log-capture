/**
 * Docker/container integration: at session end, optionally capture container
 * id from config or docker ps, then run docker inspect and docker logs
 * for the session time range and write sidecar.
 */

import { execSync } from 'child_process';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('docker');
}

function runCli(runtime: string, args: string[], timeoutMs: number): { stdout: string; ok: boolean } {
    try {
        const out = execSync(`${runtime} ${args.join(' ')}`, {
            encoding: 'utf-8',
            timeout: timeoutMs,
            maxBuffer: 4 * 1024 * 1024,
        });
        return { stdout: out.trim(), ok: true };
    } catch {
        return { stdout: '', ok: false };
    }
}

function resolveContainerId(
    context: IntegrationEndContext,
    runtime: string,
): string | undefined {
    const cfg = context.config.integrationsDocker;
    if (cfg.containerId) { return cfg.containerId; }
    if (!cfg.containerNamePattern) { return undefined; }
    const { stdout } = runCli(runtime, ['ps', '--format', '{{.Names}}\t{{.ID}}'], 5000);
    if (!stdout) { return undefined; }
    const re = new RegExp(cfg.containerNamePattern, 'i');
    for (const line of stdout.split('\n')) {
        const [name, id] = line.split('\t');
        if (name && id && re.test(name)) { return id; }
    }
    return undefined;
}

export const dockerContainersProvider: IntegrationProvider = {
    id: 'docker',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const { baseFileName, sessionStartTime, sessionEndTime } = context;
        const cfg = context.config.integrationsDocker;
        const runtime = cfg.runtime;
        const containerId = resolveContainerId(context, runtime);
        if (!containerId) { return undefined; }
        const inspectResult = runCli(runtime, ['inspect', containerId], 10000);
        let image = '';
        let imageId = '';
        if (inspectResult.ok && inspectResult.stdout) {
            try {
                const arr = JSON.parse(inspectResult.stdout) as Array<Record<string, unknown>>;
                const c = arr[0];
                const config = c?.Config as Record<string, unknown> | undefined;
                image = (config?.Image as string) ?? (c?.Config as Record<string, string>)?.Image ?? '';
                imageId = (c?.Image as string) ?? '';
            } catch {
                // ignore
            }
        }
        let logContent = '';
        if (cfg.captureLogs) {
            const since = Math.floor((sessionStartTime - 60) / 1000);
            const until = Math.ceil((sessionEndTime + 60_000) / 1000); // 60s lag to avoid clipping late logs
            const { stdout } = runCli(runtime, [
                'logs', '--since', `${since}s`, '--until', `${until}s`, '--tail', String(cfg.maxLogLines), containerId,
            ], 15000);
            logContent = stdout || '';
        }
        const addInspectSidecar = cfg.includeInspect && inspectResult.ok && inspectResult.stdout;
        const inspectSidecarName = `${baseFileName}.container-inspect.json`;
        const payload: Record<string, unknown> = {
            containerId,
            image,
            imageId,
            runtime,
            sidecar: `${baseFileName}.container.log`,
        };
        if (addInspectSidecar) { payload.inspectSidecar = inspectSidecarName; }
        const result: Contribution[] = [
            { kind: 'meta', key: 'docker', payload },
        ];
        if (logContent) {
            result.push({
                kind: 'sidecar',
                filename: `${baseFileName}.container.log`,
                content: logContent,
                contentType: 'utf8',
            });
        }
        if (addInspectSidecar) {
            result.push({
                kind: 'sidecar',
                filename: inspectSidecarName,
                content: inspectResult.stdout,
                contentType: 'utf8',
            });
        }
        return result;
    },
};
