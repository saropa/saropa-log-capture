/**
 * Environment snapshot integration: env checksum (from launch config) and
 * config file content hashes for reproducibility. Sync-only.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { shouldRedactEnvVar } from '../../config/config';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('environment');
}

function envChecksum(env: Record<string, unknown>, redactPatterns: readonly string[]): string | undefined {
    if (!env || typeof env !== 'object') { return undefined; }
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        const v = String(value ?? '');
        const redacted = shouldRedactEnvVar(key, redactPatterns) ? '***REDACTED***' : v;
        pairs.push(`${key}=${redacted}`);
    }
    if (pairs.length === 0) { return undefined; }
    pairs.sort();
    const block = pairs.join('\n');
    return crypto.createHash('sha256').update(block, 'utf-8').digest('hex').slice(0, 12);
}

function hashFileContent(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function readAndHashConfigFile(workspaceFolder: vscode.WorkspaceFolder, relativePath: string): string | undefined {
    try {
        const absPath = resolveWorkspaceFileUri(workspaceFolder, relativePath).fsPath;
        const buf = fs.readFileSync(absPath);
        return hashFileContent(buf);
    } catch {
        return undefined;
    }
}

export const environmentSnapshotProvider: IntegrationProvider = {
    id: 'environment',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { sessionContext, workspaceFolder, config } = context;
        const { includeEnvChecksum, configFiles, includeInHeader } = config.integrationsEnvironment;
        const lines: string[] = [];
        const payload: Record<string, unknown> = {};

        if (includeEnvChecksum) {
            const env = sessionContext.configuration?.env as Record<string, unknown> | undefined;
            const sum = env ? envChecksum(env, config.redactEnvVars) : undefined;
            if (sum) {
                lines.push(`Env checksum:   sha256:${sum}`);
                payload.envChecksum = sum;
            }
        }

        const configChecksums: Record<string, string> = {};
        for (const rel of configFiles) {
            const hash = readAndHashConfigFile(workspaceFolder, rel);
            if (hash) {
                configChecksums[rel] = hash;
                if (includeInHeader) {
                    lines.push(`Config ${rel}:  sha256:${hash}`);
                }
            }
        }
        if (Object.keys(configChecksums).length > 0) {
            payload.configChecksums = configChecksums;
        }

        if (lines.length === 0) { return undefined; }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'environment', payload },
        ];
    },
};
