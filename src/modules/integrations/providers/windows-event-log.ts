/**
 * Windows Event Log integration: at session end (Windows only), queries
 * Application/System (and optionally Security) for the session time range
 * and writes events to a sidecar JSON file.
 */

import { execFileSync } from 'child_process';
import * as os from 'os';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';

function isEnabled(context: IntegrationContext): boolean {
    if (os.platform() !== 'win32') { return false; }
    return (context.config.integrationsAdapters ?? []).includes('windowsEvents');
}

/**
 * Escape a value for embedding inside a PowerShell single-quoted string
 * literal (double any embedded `'`). WHY: `cfg.logs` (event log names) is a
 * workspace-scoped setting; without escaping, a log name containing `'`
 * could break out of the `@('...')` literal and inject arbitrary PowerShell.
 */
function escapePowerShellSingleQuoted(value: string): string {
    return value.replace(/'/g, "''");
}

function buildWindowsEventScript(
    startStr: string,
    endStr: string,
    logs: readonly string[],
    maxEvents: number,
): string {
    const logList = logs.map(l => `'${escapePowerShellSingleQuoted(l)}'`).join(',');
    return `$s=[DateTime]::Parse('${startStr}');$e=[DateTime]::Parse('${endStr}');` +
        `Get-WinEvent -FilterHashtable @{LogName=@(${logList});StartTime=$s;EndTime=$e} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue|` +
        `Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message,LogName|ConvertTo-Json -Compress`;
}

function queryWindowsEvents(
    context: IntegrationEndContext,
): Array<{ time: string; id: number; level: string; provider: string; message: string; log: string }> {
    const { sessionStartTime, sessionEndTime, outputChannel } = context;
    const cfg = context.config.integrationsWindowsEvents;
    const start = new Date(sessionStartTime - cfg.leadMinutes * 60 * 1000);
    const end = new Date(sessionEndTime + cfg.lagMinutes * 60 * 1000);
    const script = buildWindowsEventScript(start.toISOString(), end.toISOString(), cfg.logs, cfg.maxEvents);
    try {
        // WHY execFileSync over execSync: execSync runs the whole command line
        // through cmd.exe, which re-parses it — a log name or path containing
        // shell metacharacters could inject additional commands. execFileSync
        // passes `-Command` as a single literal argv entry, so cmd.exe never
        // sees or re-parses the PowerShell script text.
        const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `& { ${script} }`], {
            encoding: 'utf-8',
            timeout: 15000,
            maxBuffer: 4 * 1024 * 1024,
        });
        const raw = out.trim();
        if (!raw) { return []; }
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr.map((e: Record<string, unknown>) => ({
            time: e.TimeCreated ? String(e.TimeCreated) : '',
            id: Number(e.Id) || 0,
            level: String(e.LevelDisplayName ?? e.Level ?? ''),
            provider: String(e.ProviderName ?? ''),
            message: (String(e.Message ?? '')).slice(0, 2000),
            log: String(e.LogName ?? ''),
        }));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[windowsEvents] Query failed: ${msg}`);
        return [];
    }
}

export const windowsEventLogProvider: IntegrationProvider = {
    id: 'windowsEvents',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const events = queryWindowsEvents(context);
        if (events.length === 0) { return undefined; }
        const errors = events.filter(e => e.level === 'Error' || e.level === 'Critical').length;
        const warnings = events.filter(e => e.level === 'Warning').length;
        const summary = `${errors} Error(s), ${warnings} Warning(s)`;
        const { baseFileName } = context;
        const payload = { summary, count: events.length, sidecar: `${baseFileName}.events.json` };
        const sidecarContent = JSON.stringify(events, null, 2);
        return [
            { kind: 'meta', key: 'windowsEvents', payload },
            { kind: 'sidecar', filename: `${baseFileName}.events.json`, content: sidecarContent, contentType: 'json' },
        ];
    },
};
