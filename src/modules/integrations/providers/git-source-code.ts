/**
 * Git integration: adds git describe, uncommitted files summary, and stash count
 * to session header and meta. Sync-only; runs git commands with a short timeout.
 */

import { execSync } from 'child_process';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';

const GIT_TIMEOUT_MS = 3000;
const MAX_UNCOMMITTED_PATHS = 10;

function isEnabled(context: IntegrationContext): boolean {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('git');
}

function runGitSync(cwd: string, args: string[]): string | undefined {
    try {
        const out = execSync(`git ${args.join(' ')}`, {
            encoding: 'utf-8',
            cwd,
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: 64 * 1024,
        });
        return typeof out === 'string' ? out.trim() : undefined;
    } catch {
        return undefined;
    }
}

function getDescribe(cwd: string): string | undefined {
    return runGitSync(cwd, ['describe', '--tags', '--always']);
}

function getUncommittedPaths(cwd: string): string[] {
    const out = runGitSync(cwd, ['status', '--porcelain']);
    if (!out) { return []; }
    return out.split('\n')
        .map(line => line.slice(3).trim())
        .filter(Boolean)
        .slice(0, MAX_UNCOMMITTED_PATHS);
}

function getStashCount(cwd: string): number {
    const out = runGitSync(cwd, ['stash', 'list']);
    if (!out) { return 0; }
    return out.split('\n').filter(Boolean).length;
}

export const gitSourceCodeProvider: IntegrationProvider = {
    id: 'git',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const cwd = context.workspaceFolder.uri.fsPath;
        const { describeInHeader, uncommittedInHeader, stashInHeader } = context.config.integrationsGit;
        const lines: string[] = [];
        const payload: Record<string, unknown> = {};

        if (describeInHeader) {
            const describe = getDescribe(cwd);
            if (describe) {
                lines.push(`Git describe:   ${describe}`);
                payload.describe = describe;
            }
        }

        if (uncommittedInHeader) {
            const paths = getUncommittedPaths(cwd);
            const total = runGitSync(cwd, ['status', '--porcelain']);
            const count = total ? total.split('\n').filter(Boolean).length : 0;
            if (count > 0) {
                const summary = paths.length < count
                    ? `${paths.join(', ')} (+${count - paths.length} more)`
                    : paths.join(', ');
                lines.push(`Uncommitted:    ${count} file(s) — ${summary}`);
                payload.uncommittedCount = count;
                payload.uncommittedPaths = paths;
            }
        }

        if (stashInHeader) {
            const stashCount = getStashCount(cwd);
            if (stashCount > 0) {
                lines.push(`Stash:          ${stashCount} entries`);
                payload.stashCount = stashCount;
            }
        }

        if (lines.length === 0) { return undefined; }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'git', payload },
        ];
    },
};
