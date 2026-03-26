"use strict";
/**
 * Security / audit logs integration: Windows Security channel (opt-in) and
 * optional app audit file. Redacts sensitive fields when configured.
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
exports.securityAuditProvider = void 0;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('security');
}
function redact(msg) {
    return msg
        .replace(/\b(?:TargetUserName|Account Name|SubjectUserName)\s*[:=]\s*[^\s,]+/gi, 'TargetUserName=REDACTED')
        .replace(/\bIpAddress\s*[:=]\s*[\d.]+/g, 'IpAddress=REDACTED');
}
function querySecurityChannel(context) {
    if (os.platform() !== 'win32') {
        return [];
    }
    const cfg = context.config.integrationsSecurity;
    if (!cfg.windowsSecurityLog) {
        return [];
    }
    const { sessionStartTime, sessionEndTime, outputChannel } = context;
    const start = new Date(sessionStartTime - 2 * 60 * 1000).toISOString();
    const end = new Date(sessionEndTime + 5 * 60 * 1000).toISOString();
    const script = `$s=[DateTime]::Parse('${start}');$e=[DateTime]::Parse('${end}');Get-WinEvent -FilterHashtable @{LogName='Security';StartTime=$s;EndTime=$e} -MaxEvents 500 -ErrorAction SilentlyContinue|Select-Object TimeCreated,Id,LevelDisplayName,Message|ConvertTo-Json -Compress`;
    try {
        const out = (0, child_process_1.execSync)(`powershell -NoProfile -NonInteractive -Command "& { ${script} }"`, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
        const raw = out.trim();
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const redactMsg = cfg.redactSecurityEvents ? redact : (m) => m;
        return arr.map((e) => ({
            time: e.TimeCreated ? String(e.TimeCreated) : '',
            id: Number(e.Id) || 0,
            level: String(e.LevelDisplayName ?? e.Level ?? ''),
            message: redactMsg((String(e.Message ?? '')).slice(0, 1000)),
        }));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[security] Security channel query failed: ${msg}`);
        return [];
    }
}
exports.securityAuditProvider = {
    id: 'security',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const contributions = [];
        const cfg = context.config.integrationsSecurity;
        const payload = {};
        if (cfg.windowsSecurityLog && os.platform() === 'win32') {
            const events = querySecurityChannel(context);
            if (events.length > 0) {
                const sidecarContent = JSON.stringify(events, null, 2);
                payload.securitySidecar = `${context.baseFileName}.security-events.json`;
                contributions.push({ kind: 'sidecar', filename: `${context.baseFileName}.security-events.json`, content: sidecarContent, contentType: 'json' });
            }
        }
        if (cfg.auditLogPath) {
            try {
                const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.auditLogPath);
                const content = fs.readFileSync(uri.fsPath, 'utf-8').split(/\r?\n/).slice(-5000).join('\n');
                if (content.trim()) {
                    payload.auditSidecar = `${context.baseFileName}.audit.log`;
                    contributions.push({ kind: 'sidecar', filename: `${context.baseFileName}.audit.log`, content, contentType: 'utf8' });
                }
            }
            catch (err) {
                context.outputChannel.appendLine(`[security] Audit file read failed: ${err}`);
            }
        }
        if (Object.keys(payload).length > 0) {
            contributions.unshift({ kind: 'meta', key: 'security', payload });
        }
        return contributions.length > 0 ? contributions : undefined;
    },
};
//# sourceMappingURL=security-audit.js.map