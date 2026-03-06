/**
 * Export current log session to Grafana Loki via the push API.
 * See docs/wow-specs/EXPORT_LOKI_GRAFANA.md.
 */

import * as vscode from 'vscode';
import type { IntegrationLokiConfig } from '../config/config';
import type { SessionMetadataStore } from '../session/session-metadata';

const LOKI_SECRET_KEY = 'saropaLogCapture.loki.bearerToken';
const JOB_LABEL = 'saropa-log-capture';
const PUSH_TIMEOUT_MS = 30_000;

/** Loki push API request body: streams array. */
interface LokiStream {
    stream: Record<string, string>;
    values: [string, string][]; // [timestamp_nanoseconds, log_line]
}

export interface ExportToLokiResult {
    success: boolean;
    statusCode?: number;
    errorMessage?: string;
}

/**
 * Build a session label value safe for Loki (alphanumeric, dash, underscore).
 */
function sanitizeSessionLabel(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'session';
}

/**
 * Get bearer token from SecretStorage. Returns undefined if not set.
 */
export async function getLokiBearerToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        return await context.secrets.get(LOKI_SECRET_KEY) ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * Store bearer token in SecretStorage. Call from a command that prompts the user.
 */
export async function setLokiBearerToken(context: vscode.ExtensionContext, token: string): Promise<void> {
    await context.secrets.store(LOKI_SECRET_KEY, token);
}

/**
 * Read log file content and build Loki push payload.
 * Uses file mtime (nanoseconds) for all lines when no per-line timestamps are present.
 */
async function buildLokiPayload(
    logUri: vscode.Uri,
    sessionLabel: string,
    metaStore: SessionMetadataStore | undefined,
): Promise<LokiStream> {
    const [raw, stat] = await Promise.all([
        vscode.workspace.fs.readFile(logUri),
        vscode.workspace.fs.stat(logUri),
    ]);
    const text = Buffer.from(raw).toString('utf-8');
    // Keep all lines including empty ones so log structure is preserved in Loki.
    const lines = text.split(/\r?\n/).filter(line => line.length > 0 || line === '');
    // Loki timestamp: nanoseconds as string (FileStat.mtime is ms since epoch)
    const ns = Math.floor((stat.mtime ?? Date.now()) * 1e6).toString();
    const values: [string, string][] = lines.map(line => [ns, line]);

    const stream: LokiStream = {
        stream: {
            job: JOB_LABEL,
            session: sessionLabel,
        },
        values,
    };

    if (metaStore) {
        try {
            const meta = await metaStore.loadMetadata(logUri);
            if (meta.appVersion) {
                stream.stream.app_version = sanitizeSessionLabel(meta.appVersion);
            }
        } catch {
            // ignore
        }
    }

    return stream;
}

/**
 * Push the built stream to Loki. Uses Bearer token from SecretStorage if present.
 */
async function pushToLoki(
    pushUrl: string,
    stream: LokiStream,
    bearerToken: string | undefined,
): Promise<ExportToLokiResult> {
    const body = JSON.stringify({ streams: [stream] });
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);

    try {
        const res = await fetch(pushUrl, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
            return { success: true, statusCode: res.status };
        }
        const text = await res.text();
        return {
            success: false,
            statusCode: res.status,
            errorMessage: text ? `${res.status} ${res.statusText}: ${text.slice(0, 200)}` : `${res.status} ${res.statusText}`,
        };
    } catch (err) {
        clearTimeout(timeout);
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, errorMessage: msg };
    }
}

/**
 * Export the log at logUri to Loki. Caller must ensure loki.enabled and loki.pushUrl are set.
 * metaStore is optional (for app_version label).
 */
export async function exportToLoki(
    logUri: vscode.Uri,
    lokiConfig: IntegrationLokiConfig,
    context: vscode.ExtensionContext,
    metaStore: SessionMetadataStore | undefined,
): Promise<ExportToLokiResult> {
    const pushUrl = lokiConfig.pushUrl.trim();
    if (!pushUrl) {
        return { success: false, errorMessage: 'Loki push URL is not configured.' };
    }

    const baseName = logUri.path.split(/[/\\]/).pop() ?? 'session';
    const sessionLabel = sanitizeSessionLabel(baseName.replace(/\.[^.]+$/, '') || baseName);

    const stream = await buildLokiPayload(logUri, sessionLabel, metaStore);
    const bearerToken = await getLokiBearerToken(context);
    const result = await pushToLoki(pushUrl, stream, bearerToken);

    return result;
}
