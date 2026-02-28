/**
 * Development environment data collector.
 *
 * Gathers git state, runtime info, workspace config, system resources,
 * and installed debug extensions. Used by the context header and bug reports.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { runGitCommand } from './workspace-analyzer';

/** Collected development environment snapshot. */
export interface DevEnvironment {
    readonly gitBranch: string;
    readonly gitCommit: string;
    readonly gitDirty: boolean;
    readonly gitRemote: string;
    readonly nodeVersion: string;
    readonly workspaceType: 'single' | 'multi-root' | 'none';
    readonly workspaceTrusted: boolean;
    readonly remoteName: string;
    readonly cpuCount: number;
    readonly totalMemoryMb: number;
    readonly debugExtensions: readonly string[];
}

/** Collect development environment data. All fields best-effort (never throws). */
export async function collectDevEnvironment(): Promise<DevEnvironment> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const [branch, commit, porcelain, remote] = cwd
        ? await Promise.all([
            runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd),
            runGitCommand(['rev-parse', '--short', 'HEAD'], cwd),
            runGitCommand(['status', '--porcelain'], cwd),
            runGitCommand(['remote', 'get-url', 'origin'], cwd),
        ])
        : ['', '', '', ''];

    const folders = vscode.workspace.workspaceFolders;
    const wsType = !folders ? 'none' : folders.length > 1 ? 'multi-root' : 'single';

    return {
        gitBranch: branch,
        gitCommit: commit,
        gitDirty: porcelain.length > 0,
        gitRemote: stripCredentials(remote),
        nodeVersion: process.version,
        workspaceType: wsType,
        workspaceTrusted: vscode.workspace.isTrusted,
        remoteName: vscode.env.remoteName ?? '',
        cpuCount: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / 1048576),
        debugExtensions: listDebugExtensions(),
    };
}

/** Format DevEnvironment as key-value pairs for display. */
export function formatDevEnvironment(env: DevEnvironment): Record<string, string> {
    const result: Record<string, string> = {};
    if (env.gitBranch) { result['Git Branch'] = env.gitBranch; }
    if (env.gitCommit) {
        result['Git Commit'] = `${env.gitCommit}${env.gitDirty ? ' (dirty)' : ''}`;
    }
    if (env.gitRemote) { result['Git Remote'] = env.gitRemote; }
    result['Node'] = env.nodeVersion;
    result['Workspace'] = `${env.workspaceType}${env.workspaceTrusted ? '' : ' (untrusted)'}`;
    if (env.remoteName) { result['Remote'] = env.remoteName; }
    result['System'] = `${env.cpuCount} CPUs, ${env.totalMemoryMb} MB RAM`;
    if (env.debugExtensions.length > 0) {
        result['Debug Extensions'] = env.debugExtensions.join(', ');
    }
    return result;
}

function stripCredentials(url: string): string {
    return url.replace(/\/\/[^@]+@/, '//');
}

function listDebugExtensions(): string[] {
    return vscode.extensions.all
        .filter(ext => {
            const cats: string[] = ext.packageJSON?.categories ?? [];
            return cats.some(c => c.toLowerCase() === 'debuggers');
        })
        .map(ext => `${ext.id}@${ext.packageJSON?.version ?? '?'}`)
        .sort();
}
