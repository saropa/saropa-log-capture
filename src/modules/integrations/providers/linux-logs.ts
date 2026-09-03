/**
 * WSL / Linux logs integration: at session end, run dmesg and/or journalctl
 * in WSL or on remote Linux and write output to a sidecar.
 */

import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';

// WHY execFile over exec: exec runs the command through a shell, so any
// interpolated value (e.g. the workspace-scoped `wslDistro` setting) that
// contains shell metacharacters can inject or chain additional commands.
// execFile takes argv arrays directly and never invokes a shell.
const execFileAsync = promisify(execFile);

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
            const { stdout } = await execFileAsync(cmd, args, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
            return (stdout as string).split('\n').slice(-maxLines).join('\n');
        } catch {
            return '';
        }
    };

    const runWsl = async (bash: string): Promise<string> => {
        try {
            // `cfg.wslDistro` is a workspace-scoped setting; pass it as a
            // literal argv entry (not concatenated into a shell string) so a
            // value like `; rm -rf /` cannot be interpreted by a shell.
            const distroArgs = cfg.wslDistro ? ['-d', cfg.wslDistro] : [];
            const { stdout } = await execFileAsync('wsl', [...distroArgs, '-e', 'bash', '-c', bash], { encoding: 'utf-8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
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
        // journalctlArgs are used two ways below: as a literal argv array for
        // the local (no-shell) case, and quoted into a bash -c string for the
        // WSL case, where `runWsl` already routes wslDistro safely.
        const journalctlArgs = ['-b', '--since', start, '--until', end, '--no-pager', '-o', 'short-precise', '-n', String(maxLines)];
        if (onLinux) {
            try {
                const { stdout } = await execFileAsync('journalctl', journalctlArgs, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
                parts.push('=== journalctl ===\n' + (stdout as string).split('\n').slice(-maxLines).join('\n'));
            } catch {
                parts.push('=== journalctl ===\n(not available)');
            }
        } else if (targetWsl) {
            const jc = `journalctl ${journalctlArgs.map(a => JSON.stringify(a)).join(' ')} 2>/dev/null`;
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
