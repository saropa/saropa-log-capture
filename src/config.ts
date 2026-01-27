import * as vscode from 'vscode';
import * as path from 'path';

export interface SaropaLogCaptureConfig {
    readonly enabled: boolean;
    readonly categories: readonly string[];
    readonly maxLines: number;
    readonly includeTimestamp: boolean;
    readonly format: 'plaintext' | 'html';
    readonly logDirectory: string;
    readonly autoOpen: boolean;
    readonly maxLogFiles: number;
    readonly gitignoreCheck: boolean;
    readonly redactEnvVars: readonly string[];
}

const SECTION = 'saropaLogCapture';

export function getConfig(): SaropaLogCaptureConfig {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    return {
        enabled: cfg.get<boolean>('enabled', true),
        categories: cfg.get<string[]>('categories', ['console', 'stdout', 'stderr']),
        maxLines: cfg.get<number>('maxLines', 100000),
        includeTimestamp: cfg.get<boolean>('includeTimestamp', true),
        format: cfg.get<'plaintext' | 'html'>('format', 'plaintext'),
        logDirectory: cfg.get<string>('logDirectory', 'reports'),
        autoOpen: cfg.get<boolean>('autoOpen', false),
        maxLogFiles: cfg.get<number>('maxLogFiles', 10),
        gitignoreCheck: cfg.get<boolean>('gitignoreCheck', true),
        redactEnvVars: cfg.get<string[]>('redactEnvVars', []),
    };
}

export function getLogDirectoryUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
    const config = getConfig();
    if (path.isAbsolute(config.logDirectory)) {
        return vscode.Uri.file(config.logDirectory);
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, config.logDirectory);
}

/**
 * Returns true if the env var name matches any pattern in redactEnvVars.
 * Supports * wildcards (glob-style, case-insensitive).
 */
export function shouldRedactEnvVar(name: string, patterns: readonly string[]): boolean {
    for (const pattern of patterns) {
        const regex = new RegExp(
            '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
            'i'
        );
        if (regex.test(name)) {
            return true;
        }
    }
    return false;
}
