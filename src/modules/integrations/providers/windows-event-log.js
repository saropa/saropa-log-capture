"use strict";
/**
 * Windows Event Log integration: at session end (Windows only), queries
 * Application/System (and optionally Security) for the session time range
 * and writes events to a sidecar JSON file.
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
exports.windowsEventLogProvider = void 0;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
function isEnabled(context) {
    if (os.platform() !== 'win32') {
        return false;
    }
    return (context.config.integrationsAdapters ?? []).includes('windowsEvents');
}
function queryWindowsEvents(context) {
    const { sessionStartTime, sessionEndTime, outputChannel } = context;
    const cfg = context.config.integrationsWindowsEvents;
    const start = new Date(sessionStartTime - cfg.leadMinutes * 60 * 1000);
    const end = new Date(sessionEndTime + cfg.lagMinutes * 60 * 1000);
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    const logList = cfg.logs.map(l => `'${l}'`).join(',');
    const script = `$s=[DateTime]::Parse('${startStr}');$e=[DateTime]::Parse('${endStr}');` +
        `Get-WinEvent -FilterHashtable @{LogName=@(${logList});StartTime=$s;EndTime=$e} -MaxEvents ${cfg.maxEvents} -ErrorAction SilentlyContinue|` +
        `Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message,LogName|ConvertTo-Json -Compress`;
    try {
        const out = (0, child_process_1.execSync)(`powershell -NoProfile -NonInteractive -Command "& { ${script} }"`, {
            encoding: 'utf-8',
            timeout: 15000,
            maxBuffer: 4 * 1024 * 1024,
        });
        const raw = out.trim();
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr.map((e) => ({
            time: e.TimeCreated ? String(e.TimeCreated) : '',
            id: Number(e.Id) || 0,
            level: String(e.LevelDisplayName ?? e.Level ?? ''),
            provider: String(e.ProviderName ?? ''),
            message: (String(e.Message ?? '')).slice(0, 2000),
            log: String(e.LogName ?? ''),
        }));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[windowsEvents] Query failed: ${msg}`);
        return [];
    }
}
exports.windowsEventLogProvider = {
    id: 'windowsEvents',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const events = queryWindowsEvents(context);
        if (events.length === 0) {
            return undefined;
        }
        const errors = events.filter(e => e.level === 'Error' || e.level === 'Critical').length;
        const warnings = events.filter(e => e.level === 'Warning').length;
        const summary = `${errors} Error(s), ${warnings} Warning(s)`;
        const { baseFileName } = context;
        const payload = { summary, count: events.length, sidecar: `${baseFileName}.events.json` };
        const sidecarContent = JSON.stringify(events, null, 2);
        return [
            { kind: 'meta', key: 'windowsEvents', payload },
            { kind: 'sidecar', filename: `${baseFileName}.events.json`, content: sidecarContent, contentType: 'json' },
        ];
    },
};
//# sourceMappingURL=windows-event-log.js.map