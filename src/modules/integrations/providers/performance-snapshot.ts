/**
 * Performance integration: system snapshot at session start (CPUs, RAM), optional
 * periodic sampling during session, and optional profiler output reference.
 * Writes header line, meta, and basename.perf.json sidecar when sampling is enabled.
 */

import * as os from 'os';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';

export interface PerformanceSnapshot {
    cpus: number;
    totalMemMb: number;
    freeMemMb: number;
    loadAvg?: number[];
    processMemMb?: number;
}

const samples: { t: number; freememMb: number; loadAvg1?: number }[] = [];
let samplingTimer: ReturnType<typeof setInterval> | undefined;
let lastSnapshot: PerformanceSnapshot | undefined;

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('performance');
}

function getSystemSnapshot(): PerformanceSnapshot {
    const totalMemMb = Math.round(os.totalmem() / 1048576);
    const freeMemMb = Math.round(os.freemem() / 1048576);
    const loadAvg = os.loadavg?.();
    return {
        cpus: os.cpus().length,
        totalMemMb,
        freeMemMb,
        loadAvg: loadAvg && loadAvg.length > 0 ? [...loadAvg] : undefined,
    };
}

function formatSnapshotLine(snapshot: PerformanceSnapshot): string {
    const parts = [`System: ${snapshot.cpus} CPUs, ${snapshot.totalMemMb} MB RAM (${snapshot.freeMemMb} MB free)`];
    if (snapshot.processMemMb !== undefined && snapshot.processMemMb !== null) {
        parts.push(`; process: ${snapshot.processMemMb} MB`);
    }
    return parts.join('');
}

/** Start periodic sampling (called from onSessionStartAsync). */
export function startPerformanceSampling(intervalMs: number): void {
    samples.length = 0;
    if (samplingTimer) {
        clearInterval(samplingTimer);
        samplingTimer = undefined;
    }
    samplingTimer = setInterval(() => {
        try {
            const freememMb = Math.round(os.freemem() / 1048576);
            const loadAvg = os.loadavg?.();
            samples.push({
                t: Date.now(),
                freememMb,
                loadAvg1: loadAvg && loadAvg.length > 0 ? loadAvg[0] : undefined,
            });
        } catch {
            // ignore
        }
    }, intervalMs);
}

/** Stop sampling and return collected samples (called from onSessionEnd). Clears in-memory samples after copy to avoid cross-session leak. */
export function stopPerformanceSampling(): { t: number; freememMb: number; loadAvg1?: number }[] {
    if (samplingTimer) {
        clearInterval(samplingTimer);
        samplingTimer = undefined;
    }
    const copy = [...samples];
    samples.length = 0;
    return copy;
}

export const performanceSnapshotProvider: IntegrationProvider = {
    id: 'performance',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsPerformance;
        if (!cfg.snapshotAtStart) { return undefined; }
        const snapshot = getSystemSnapshot();
        lastSnapshot = snapshot;
        if (cfg.includeInHeader) {
            const line = formatSnapshotLine(snapshot);
            const payload: Record<string, unknown> = { snapshot };
            if (cfg.sampleDuringSession) {
                payload.samplesNote = 'Periodic samples will be written at session end.';
            }
            return [
                { kind: 'header', lines: [line] },
                { kind: 'meta', key: 'performance', payload },
            ];
        }
        return [
            { kind: 'meta', key: 'performance', payload: { snapshot } },
        ];
    },

    async onSessionStartAsync(context: IntegrationContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsPerformance;
        if (cfg.sampleDuringSession && cfg.sampleIntervalSeconds > 0) {
            startPerformanceSampling(cfg.sampleIntervalSeconds * 1000);
        }
        return undefined;
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const collected = stopPerformanceSampling();
        const contributions: Contribution[] = [];
        const payload: Record<string, unknown> = { snapshot: lastSnapshot };
        lastSnapshot = undefined;
        if (collected.length > 0) {
            const sidecarContent = JSON.stringify({ samples: collected }, null, 2);
            contributions.push({
                kind: 'sidecar',
                filename: `${context.baseFileName}.perf.json`,
                content: sidecarContent,
                contentType: 'json',
            });
            payload.samplesFile = `${context.baseFileName}.perf.json`;
            payload.sampleCount = collected.length;
        }
        contributions.push({ kind: 'meta', key: 'performance', payload });
        return contributions;
    },
};
