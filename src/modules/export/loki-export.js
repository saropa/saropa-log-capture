"use strict";
/**
 * Export current log session to Grafana Loki via the push API.
 * See docs/wow-specs/EXPORT_LOKI_GRAFANA.md.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLokiBearerToken = getLokiBearerToken;
exports.setLokiBearerToken = setLokiBearerToken;
exports.exportToLoki = exportToLoki;
const vscode = __importStar(require("vscode"));
const LOKI_SECRET_KEY = 'saropaLogCapture.loki.bearerToken';
const JOB_LABEL = 'saropa-log-capture';
const PUSH_TIMEOUT_MS = 30_000;
/**
 * Build a session label value safe for Loki (alphanumeric, dash, underscore).
 */
function sanitizeSessionLabel(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'session';
}
/**
 * Get bearer token from SecretStorage. Returns undefined if not set.
 */
async function getLokiBearerToken(context) {
    try {
        return await context.secrets.get(LOKI_SECRET_KEY) ?? undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Store bearer token in SecretStorage. Call from a command that prompts the user.
 */
async function setLokiBearerToken(context, token) {
    await context.secrets.store(LOKI_SECRET_KEY, token);
}
/**
 * Read log file content and build Loki push payload.
 * Uses file mtime (nanoseconds) for all lines when no per-line timestamps are present.
 */
async function buildLokiPayload(logUri, sessionLabel, metaStore) {
    const [raw, stat] = await Promise.all([
        vscode.workspace.fs.readFile(logUri),
        vscode.workspace.fs.stat(logUri),
    ]);
    const text = Buffer.from(raw).toString('utf-8');
    // Keep all lines including empty ones so log structure is preserved in Loki.
    const lines = text.split(/\r?\n/).filter(line => line.length > 0 || line === '');
    // Loki timestamp: nanoseconds as string (FileStat.mtime is ms since epoch)
    const ns = Math.floor((stat.mtime ?? Date.now()) * 1e6).toString();
    const values = lines.map(line => [ns, line]);
    const stream = {
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
        }
        catch {
            // ignore
        }
    }
    return stream;
}
/**
 * Push the built stream to Loki. Uses Bearer token from SecretStorage if present.
 */
async function pushToLoki(pushUrl, stream, bearerToken) {
    const body = JSON.stringify({ streams: [stream] });
    const headers = {
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
    }
    catch (err) {
        clearTimeout(timeout);
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, errorMessage: msg };
    }
}
/**
 * Export the log at logUri to Loki. Caller must ensure loki.enabled and loki.pushUrl are set.
 * metaStore is optional (for app_version label).
 */
async function exportToLoki(logUri, lokiConfig, context, metaStore) {
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
//# sourceMappingURL=loki-export.js.map