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
exports.redact = redact;
exports.buildEventSummary = buildEventSummary;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
/** Well-known Windows Security event IDs grouped by category. */
const eventCategories = new Map([
    [4624, 'logon'], [4625, 'failed logon'], [4634, 'logoff'], [4647, 'logoff'],
    [4648, 'explicit logon'], [4672, 'special privileges'], [4688, 'process created'],
    [4689, 'process exited'], [4720, 'account created'], [4722, 'account enabled'],
    [4740, 'account locked'], [4776, 'credential validation'],
]);
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('security');
}
/** Redact sensitive fields in a Windows Security event message. */
function redact(msg) {
    return msg
        .replace(/\b(?:TargetUserName|Account Name|SubjectUserName)\s*[:=]\s*[^\s,]+/gi, 'TargetUserName=REDACTED')
        .replace(/\bIpAddress\s*[:=]\s*[\d.]+/g, 'IpAddress=REDACTED');
}
/** Build a human-readable summary from event ID categories. */
function buildEventSummary(events) {
    const counts = new Map();
    for (const e of events) {
        const cat = eventCategories.get(e.id) ?? 'other';
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const parts = [];
    for (const [cat, count] of counts) {
        parts.push(`${count} ${cat}`);
    }
    return parts.length > 0 ? parts.join(', ') : `${events.length} event(s)`;
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
    const weCfg = context.config.integrationsWindowsEvents;
    const leadMs = (weCfg.leadMinutes ?? 2) * 60 * 1000;
    const lagMs = (weCfg.lagMinutes ?? 5) * 60 * 1000;
    const start = new Date(sessionStartTime - leadMs).toISOString();
    const end = new Date(sessionEndTime + lagMs).toISOString();
    const script = `$s=[DateTime]::Parse('${start}');$e=[DateTime]::Parse('${end}');` +
        `Get-WinEvent -FilterHashtable @{LogName='Security';StartTime=$s;EndTime=$e}` +
        ` -MaxEvents 500 -ErrorAction SilentlyContinue|` +
        `Select-Object TimeCreated,Id,LevelDisplayName,Message|ConvertTo-Json -Compress`;
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
        let securityEvents = [];
        if (cfg.windowsSecurityLog && os.platform() === 'win32') {
            securityEvents = querySecurityChannel(context);
            if (securityEvents.length > 0) {
                const sidecarContent = JSON.stringify(securityEvents, null, 2);
                payload.securitySidecar = `${context.baseFileName}.security-events.json`;
                payload.summary = buildEventSummary(securityEvents);
                contributions.push({
                    kind: 'sidecar',
                    filename: `${context.baseFileName}.security-events.json`,
                    content: sidecarContent,
                    contentType: 'json',
                });
            }
        }
        if (cfg.auditLogPath) {
            try {
                const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.auditLogPath);
                const content = fs.readFileSync(uri.fsPath, 'utf-8').split(/\r?\n/).slice(-5000).join('\n');
                if (content.trim()) {
                    payload.auditSidecar = `${context.baseFileName}.audit.log`;
                    contributions.push({
                        kind: 'sidecar',
                        filename: `${context.baseFileName}.audit.log`,
                        content,
                        contentType: 'utf8',
                    });
                }
            }
            catch (err) {
                context.outputChannel.appendLine(`[security] Audit file read failed: ${err}`);
            }
        }
        if (Object.keys(payload).length > 0) {
            contributions.unshift({ kind: 'meta', key: 'security', payload });
        }
        if (cfg.includeSummaryInHeader && securityEvents.length > 0) {
            const summary = payload.summary ?? buildEventSummary(securityEvents);
            contributions.push({ kind: 'header', lines: [`Security: ${summary}`] });
        }
        return contributions.length > 0 ? contributions : undefined;
    },
};
//# sourceMappingURL=security-audit.js.map