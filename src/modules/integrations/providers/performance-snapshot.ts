/**
 * Performance integration: system snapshot at session start (CPUs, RAM), optional
 * periodic sampling during session, optional profiler output copy, and optional process memory.
 * Writes header line, meta, and basename.perf.json sidecar when sampling is enabled.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { substituteWorkspaceFolder } from '../workspace-path';

/** Max profiler file size to copy (100 MB). */
const PROFILER_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Get process working set / RSS in MB for the given PID. Platform-specific; may return undefined on failure.
 */
function getProcessMemMb(pid: number): number | undefined {
    try {
        if (process.platform === 'win32') {
            const out = cp.execSync(
                `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).WorkingSet64"`,
                { encoding: 'utf8', timeout: 5000 },
            );
            const bytes = parseInt(out.trim(), 10);
            return Number.isFinite(bytes) ? Math.round(bytes / 1048576) : undefined;
        }
        if (process.platform === 'linux') {
            const statusPath = path.join('/proc', String(pid), 'status');
            const raw = fs.readFileSync(statusPath, { encoding: 'utf8' });
            const m = raw.match(/VmRSS:\s*(\d+)\s*kB/);
            if (m) {
                const kb = parseInt(m[1], 10);
                return Number.isFinite(kb) ? Math.round(kb / 1024) : undefined;
            }
            return undefined;
        }
        if (process.platform === 'darwin') {
            const out = cp.execSync(`ps -o rss= -p ${pid}`, { encoding: 'utf8', timeout: 5000 });
            const kb = parseInt(out.trim(), 10);
            return Number.isFinite(kb) ? Math.round(kb / 1024) : undefined;
        }
    } catch {
        // Process may have exited or no permission
    }
    return undefined;
}

export interface PerformanceSnapshot {
    cpus: number;
    totalMemMb: number;
    freeMemMb: number;
    loadAvg?: number[];
    processMemMb?: number;
}

const samples: { t: number; freememMb: number; loadAvg1?: number }[] = [];
let samplingTimer: ReturnType<typeof setInterval> | undefined;
/** Last system snapshot (from most recent session start). Best-effort only when multiple debug sessions are active. */
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
        const cfg = context.config.integrationsPerformance;
        const collected = stopPerformanceSampling();
        const contributions: Contribution[] = [];
        // Populate process memory at session end when processMetrics and PID are available
        if (cfg.processMetrics && context.debugProcessId !== undefined && lastSnapshot) {
            const processMemMb = getProcessMemMb(context.debugProcessId);
            if (processMemMb !== undefined) {
                lastSnapshot = { ...lastSnapshot, processMemMb };
            }
        }
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
        // Copy external profiler output into session folder when configured
        if (cfg.profilerOutputPath && cfg.profilerOutputPath.trim() !== '') {
            const resolvedPath = substituteWorkspaceFolder(cfg.profilerOutputPath.trim(), context.workspaceFolder);
            const sourceUri = path.isAbsolute(resolvedPath)
                ? vscode.Uri.file(resolvedPath)
                : vscode.Uri.joinPath(context.workspaceFolder.uri, resolvedPath.replace(/\\/g, '/'));
            try {
                const stat = await vscode.workspace.fs.stat(sourceUri);
                if (stat.type === vscode.FileType.File && stat.size <= PROFILER_MAX_BYTES && stat.size >= 0) {
                    const ext = path.extname(resolvedPath) || '';
                    const destFileName = `${context.baseFileName}.profiler${ext}`;
                    const destUri = vscode.Uri.joinPath(context.logDirUri, destFileName);
                    await vscode.workspace.fs.copy(sourceUri, destUri);
                    payload.profilerFile = destFileName;
                } else if (stat.size > PROFILER_MAX_BYTES) {
                    context.outputChannel.appendLine(`[performance] Profiler file skipped: size ${stat.size} exceeds limit ${PROFILER_MAX_BYTES}`);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[performance] Profiler copy failed (${resolvedPath}): ${msg}`);
            }
        }
        contributions.push({ kind: 'meta', key: 'performance', payload });
        return contributions;
    },
};
