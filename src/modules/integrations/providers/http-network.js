"use strict";
/**
 * HTTP / network integration: at session end, read configured request log file
 * (JSON lines) and write to sidecar for correlation by request ID.
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
exports.httpNetworkProvider = void 0;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('http');
}
/** Try to parse a JSON string as an object, returning undefined on failure. */
function tryParseJsonObject(line) {
    try {
        const obj = JSON.parse(line);
        return obj && typeof obj === 'object' ? obj : undefined;
    }
    catch {
        return undefined;
    }
}
exports.httpNetworkProvider = {
    id: 'http',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cfg = context.config.integrationsHttp;
        if (!cfg.requestLogPath) {
            return undefined;
        }
        try {
            const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.requestLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            const lines = raw.split(/\r?\n/).filter(Boolean);
            const requests = [];
            const cap = Math.min(cfg.maxRequestsPerSession, lines.length);
            for (const line of lines.slice(-cap)) {
                const obj = tryParseJsonObject(line);
                if (obj) {
                    requests.push(obj);
                }
            }
            if (requests.length === 0) {
                return undefined;
            }
            const sidecarContent = JSON.stringify({ requests }, null, 2);
            const payload = { sidecar: `${context.baseFileName}.requests.json`, count: requests.length };
            return [
                { kind: 'meta', key: 'http', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.requests.json`, content: sidecarContent, contentType: 'json' },
            ];
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[http] Request log read failed: ${msg}`);
            return undefined;
        }
    },
};
//# sourceMappingURL=http-network.js.map