"use strict";
/**
 * Application / file logs integration: tails configured external log files during
 * session and writes sidecars at session end. If tailers were started, uses
 * buffered lines; otherwise falls back to reading last N lines from each path.
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
exports.externalLogsProvider = void 0;
const fs = __importStar(require("node:fs"));
const workspace_path_1 = require("../workspace-path");
const external_log_tailer_1 = require("../external-log-tailer");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('externalLogs');
}
function readLastLines(filePath, maxLines) {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split(/\r?\n/);
        if (lines.length <= maxLines) {
            return lines;
        }
        return lines.slice(-maxLines);
    }
    catch {
        return [];
    }
}
exports.externalLogsProvider = {
    id: 'externalLogs',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cfg = context.config.integrationsExternalLogs;
        if (!cfg.writeSidecars) {
            return undefined;
        }
        const workspaceFolder = context.workspaceFolder;
        const contributions = [];
        const sidecars = [];
        // Snapshot buffers before stop: finalizeSession must not clear tailers before providers run.
        const tailedBuffers = (0, external_log_tailer_1.getExternalLogBuffers)();
        (0, external_log_tailer_1.stopExternalLogTailers)();
        if (tailedBuffers.size > 0) {
            for (const [label, lines] of tailedBuffers) {
                if (lines.length === 0) {
                    continue;
                }
                const prefix = cfg.prefixLines ? `[${label}] ` : '';
                const content = lines.map((l) => (l ? prefix + l : l)).join('\n');
                const filename = `${context.baseFileName}.${label}.log`;
                contributions.push({ kind: 'sidecar', filename, content, contentType: 'utf8' });
                sidecars.push(filename);
            }
        }
        else if (cfg.paths.length > 0) {
            for (const relPath of cfg.paths) {
                const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, relPath);
                try {
                    const lines = readLastLines(uri.fsPath, cfg.maxLinesPerFile);
                    if (lines.length === 0) {
                        continue;
                    }
                    const label = (0, external_log_tailer_1.pathToLabel)(relPath);
                    const prefix = cfg.prefixLines ? `[${label}] ` : '';
                    const content = lines.map((l) => (l ? prefix + l : l)).join('\n');
                    const filename = `${context.baseFileName}.${label}.log`;
                    contributions.push({ kind: 'sidecar', filename, content, contentType: 'utf8' });
                    sidecars.push(filename);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    context.outputChannel.appendLine(`[externalLogs] ${relPath}: ${msg}`);
                }
            }
        }
        if (contributions.length === 0) {
            return undefined;
        }
        contributions.unshift({ kind: 'meta', key: 'externalLogs', payload: { sidecars } });
        return contributions;
    },
};
//# sourceMappingURL=external-logs.js.map