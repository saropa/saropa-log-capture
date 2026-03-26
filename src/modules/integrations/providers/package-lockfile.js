"use strict";
/**
 * Package/lockfile integration: adds lockfile hash and package manager to session
 * header and meta for reproducibility. Sync-only, minimal I/O.
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
exports.packageLockfileProvider = void 0;
const vscode = __importStar(require("vscode"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const LOCKFILE_PRIORITY = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
function isEnabled(context) {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('packages');
}
function findLockfile(workspaceFolder) {
    const root = workspaceFolder.uri.fsPath;
    for (const name of LOCKFILE_PRIORITY) {
        const p = `${root}/${name}`;
        try {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                return name;
            }
        }
        catch {
            // continue
        }
    }
    return undefined;
}
/** Max bytes to read from lockfile (avoids blocking on huge files). Hash is over first N bytes only. */
const LOCKFILE_MAX_READ = 2 * 1024 * 1024;
/** Sync read + hash; returns undefined on error or missing. Reads at most LOCKFILE_MAX_READ bytes. */
function readAndHashLockfile(workspaceFolder, filename) {
    try {
        const absPath = vscode.Uri.joinPath(workspaceFolder.uri, filename).fsPath;
        const fd = fs.openSync(absPath, 'r');
        const buf = Buffer.alloc(Math.min(LOCKFILE_MAX_READ, fs.fstatSync(fd).size));
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const hash = crypto.createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex').slice(0, 12);
        return hash;
    }
    catch {
        return undefined;
    }
}
exports.packageLockfileProvider = {
    id: 'packages',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { workspaceFolder } = context;
        const lockfile = findLockfile(workspaceFolder);
        if (!lockfile) {
            return undefined;
        }
        const hash = readAndHashLockfile(workspaceFolder, lockfile);
        if (!hash) {
            return undefined;
        }
        const manager = lockfile === 'package-lock.json' ? 'npm' : lockfile === 'yarn.lock' ? 'yarn' : 'pnpm';
        const lines = [`Lockfile:     ${manager} (${lockfile}) sha256:${hash}`];
        const payload = { packageManager: manager, lockfile, contentHash: hash };
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'packages', payload },
        ];
    },
};
//# sourceMappingURL=package-lockfile.js.map