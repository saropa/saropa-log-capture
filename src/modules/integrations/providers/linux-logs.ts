/**
 * WSL / Linux logs integration: at session end, run dmesg and/or journalctl
 * in WSL or on remote Linux and write output to a sidecar.
 */

import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';

const execAsync = promisify(exec);

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('linuxLogs');
}

function isExtensionOnLinux(): boolean {
    const remote = vscode.env.remoteName ?? '';
    return remote === 'wsl' || remote === 'ssh-remote' || os.platform() === 'linux';
}

function isTargetWsl(_context: IntegrationContext): boolean {
    return os.platform() === 'win32' && (vscode.env.remoteName === 'wsl' || !vscode.env.remoteName);
}

async function runLinuxLogs(context: IntegrationEndContext): Promise<string> {
    const cfg = context.config.integrationsLinuxLogs;
    const when = cfg.when;
    const onLinux = isExtensionOnLinux();
    const targetWsl = isTargetWsl(context);
    if (when === 'wsl' && !targetWsl && !onLinux) {return '';}
    if (when === 'remote' && !onLinux) {return '';}
    const start = new Date(context.sessionStartTime - cfg.leadMinutes * 60 * 1000).toISOString();
    const end = new Date(context.sessionEndTime + cfg.lagMinutes * 60 * 1000).toISOString();
    const parts: string[] = [];
    const maxLines = cfg.maxLines;

    const runLocal = async (cmd: string, args: string[]): Promise<string> => {
        try {
            const { stdout } = await execAsync([cmd, ...args].join(' '), { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
            return (stdout as string).split('\n').slice(-maxLines).join('\n');
        } catch {
            return '';
        }
    };

    const runWsl = async (bash: string): Promise<string> => {
        try {
            const distro = cfg.wslDistro ? ['-d', cfg.wslDistro] : [];
            const { stdout } = await execAsync(`wsl ${distro.join(' ')} -e bash -c ${JSON.stringify(bash)}`, { encoding: 'utf-8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
            return (stdout as string).split('\n').slice(-maxLines).join('\n');
        } catch {
            return '';
        }
    };

    if (cfg.sources.includes('dmesg')) {
        if (onLinux) {
            parts.push('=== dmesg -T ===\n' + await runLocal('dmesg', ['-T']));
        } else if (targetWsl) {
            parts.push('=== dmesg -T ===\n' + await runWsl('dmesg -T 2>/dev/null'));
        }
    }
    if (cfg.sources.includes('journalctl')) {
        const jc = `journalctl -b --since ${JSON.stringify(start)} --until ${JSON.stringify(end)} --no-pager -o short-precise -n ${maxLines} 2>/dev/null`;
        if (onLinux) {
            try {
                const { stdout } = await execAsync(`journalctl -b --since ${JSON.stringify(start)} --until ${JSON.stringify(end)} --no-pager -o short-precise -n ${maxLines}`, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
                parts.push('=== journalctl ===\n' + (stdout as string).split('\n').slice(-maxLines).join('\n'));
            } catch {
                parts.push('=== journalctl ===\n(not available)');
            }
        } else if (targetWsl) {
            parts.push('=== journalctl ===\n' + await runWsl(jc));
        }
    }
    return parts.filter(Boolean).join('\n\n');
}

export const linuxLogsProvider: IntegrationProvider = {
    id: 'linuxLogs',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        try {
            const content = await runLinuxLogs(context);
            if (!content.trim()) { return undefined; }
            const payload = { sidecar: `${context.baseFileName}.linux.log` };
            return [
                { kind: 'meta', key: 'linuxLogs', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.linux.log`, content, contentType: 'utf8' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[linuxLogs] Failed: ${msg}`);
            return undefined;
        }
    },
};
