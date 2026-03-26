"use strict";
/**
 * WSL / Linux logs integration: at session end, run dmesg and/or journalctl
 * in WSL or on remote Linux and write output to a sidecar.
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
exports.linuxLogsProvider = void 0;
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const vscode = __importStar(require("vscode"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('linuxLogs');
}
function isExtensionOnLinux() {
    const remote = vscode.env.remoteName ?? '';
    return remote === 'wsl' || remote === 'ssh-remote' || os.platform() === 'linux';
}
function isTargetWsl(_context) {
    return os.platform() === 'win32' && (vscode.env.remoteName === 'wsl' || !vscode.env.remoteName);
}
async function runLinuxLogs(context) {
    const cfg = context.config.integrationsLinuxLogs;
    const when = cfg.when;
    const onLinux = isExtensionOnLinux();
    const targetWsl = isTargetWsl(context);
    if (when === 'wsl' && !targetWsl && !onLinux) {
        return '';
    }
    if (when === 'remote' && !onLinux) {
        return '';
    }
    const start = new Date(context.sessionStartTime - cfg.leadMinutes * 60 * 1000).toISOString();
    const end = new Date(context.sessionEndTime + cfg.lagMinutes * 60 * 1000).toISOString();
    const parts = [];
    const maxLines = cfg.maxLines;
    const runLocal = async (cmd, args) => {
        try {
            const { stdout } = await execAsync([cmd, ...args].join(' '), { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
            return stdout.split('\n').slice(-maxLines).join('\n');
        }
        catch {
            return '';
        }
    };
    const runWsl = async (bash) => {
        try {
            const distro = cfg.wslDistro ? ['-d', cfg.wslDistro] : [];
            const { stdout } = await execAsync(`wsl ${distro.join(' ')} -e bash -c ${JSON.stringify(bash)}`, { encoding: 'utf-8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
            return stdout.split('\n').slice(-maxLines).join('\n');
        }
        catch {
            return '';
        }
    };
    if (cfg.sources.includes('dmesg')) {
        if (onLinux) {
            parts.push('=== dmesg -T ===\n' + await runLocal('dmesg', ['-T']));
        }
        else if (targetWsl) {
            parts.push('=== dmesg -T ===\n' + await runWsl('dmesg -T 2>/dev/null'));
        }
    }
    if (cfg.sources.includes('journalctl')) {
        const jc = `journalctl -b --since ${JSON.stringify(start)} --until ${JSON.stringify(end)} --no-pager -o short-precise -n ${maxLines} 2>/dev/null`;
        if (onLinux) {
            try {
                const { stdout } = await execAsync(`journalctl -b --since ${JSON.stringify(start)} --until ${JSON.stringify(end)} --no-pager -o short-precise -n ${maxLines}`, { encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
                parts.push('=== journalctl ===\n' + stdout.split('\n').slice(-maxLines).join('\n'));
            }
            catch {
                parts.push('=== journalctl ===\n(not available)');
            }
        }
        else if (targetWsl) {
            parts.push('=== journalctl ===\n' + await runWsl(jc));
        }
    }
    return parts.filter(Boolean).join('\n\n');
}
exports.linuxLogsProvider = {
    id: 'linuxLogs',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        try {
            const content = await runLinuxLogs(context);
            if (!content.trim()) {
                return undefined;
            }
            const payload = { sidecar: `${context.baseFileName}.linux.log` };
            return [
                { kind: 'meta', key: 'linuxLogs', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.linux.log`, content, contentType: 'utf8' },
            ];
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[linuxLogs] Failed: ${msg}`);
            return undefined;
        }
    },
};
//# sourceMappingURL=linux-logs.js.map