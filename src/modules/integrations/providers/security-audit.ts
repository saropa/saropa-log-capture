/**
 * Security / audit logs integration: Windows Security channel (opt-in) and
 * optional app audit file. Redacts sensitive fields when configured.
 */

import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('security');
}

function redact(msg: string): string {
    return msg
        .replace(/\b(?:TargetUserName|Account Name|SubjectUserName)\s*[:=]\s*[^\s,]+/gi, 'TargetUserName=REDACTED')
        .replace(/\bIpAddress\s*[:=]\s*[\d.]+/g, 'IpAddress=REDACTED');
}

function querySecurityChannel(context: IntegrationEndContext): Array<{ time: string; id: number; level: string; message: string }> {
    if (os.platform() !== 'win32') {return [];}
    const cfg = context.config.integrationsSecurity;
    if (!cfg.windowsSecurityLog) {return [];}
    const { sessionStartTime, sessionEndTime, outputChannel } = context;
    const start = new Date(sessionStartTime - 2 * 60 * 1000).toISOString();
    const end = new Date(sessionEndTime + 5 * 60 * 1000).toISOString();
    const script = `$s=[DateTime]::Parse('${start}');$e=[DateTime]::Parse('${end}');Get-WinEvent -FilterHashtable @{LogName='Security';StartTime=$s;EndTime=$e} -MaxEvents 500 -ErrorAction SilentlyContinue|Select-Object TimeCreated,Id,LevelDisplayName,Message|ConvertTo-Json -Compress`;
    try {
        const out = execSync(`powershell -NoProfile -NonInteractive -Command "& { ${script} }"`, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
        const raw = out.trim();
        if (!raw) {return [];}
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const redactMsg = cfg.redactSecurityEvents ? redact : (m: string) => m;
        return arr.map((e: Record<string, unknown>) => ({
            time: e.TimeCreated ? String(e.TimeCreated) : '',
            id: Number(e.Id) || 0,
            level: String(e.LevelDisplayName ?? e.Level ?? ''),
            message: redactMsg((String(e.Message ?? '')).slice(0, 1000)),
        }));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[security] Security channel query failed: ${msg}`);
        return [];
    }
}

export const securityAuditProvider: IntegrationProvider = {
    id: 'security',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const contributions: Contribution[] = [];
        const cfg = context.config.integrationsSecurity;

        const payload: Record<string, unknown> = {};
        if (cfg.windowsSecurityLog && os.platform() === 'win32') {
            const events = querySecurityChannel(context);
            if (events.length > 0) {
                const sidecarContent = JSON.stringify(events, null, 2);
                payload.securitySidecar = `${context.baseFileName}.security-events.json`;
                contributions.push({ kind: 'sidecar', filename: `${context.baseFileName}.security-events.json`, content: sidecarContent, contentType: 'json' });
            }
        }

        if (cfg.auditLogPath) {
            try {
                const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.auditLogPath);
                const content = fs.readFileSync(uri.fsPath, 'utf-8').split(/\r?\n/).slice(-5000).join('\n');
                if (content.trim()) {
                    payload.auditSidecar = `${context.baseFileName}.audit.log`;
                    contributions.push({ kind: 'sidecar', filename: `${context.baseFileName}.audit.log`, content, contentType: 'utf8' });
                }
            } catch (err) {
                context.outputChannel.appendLine(`[security] Audit file read failed: ${err}`);
            }
        }
        if (Object.keys(payload).length > 0) {
            contributions.unshift({ kind: 'meta', key: 'security', payload });
        }
        return contributions.length > 0 ? contributions : undefined;
    },
};
