"use strict";
/**
 * Environment snapshot integration: env checksum (from launch config) and
 * config file content hashes for reproducibility. Sync-only.
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
exports.environmentSnapshotProvider = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const config_1 = require("../../config/config");
const workspace_path_1 = require("../workspace-path");
function isEnabled(context) {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('environment');
}
function envChecksum(env, redactPatterns) {
    if (!env || typeof env !== 'object') {
        return undefined;
    }
    const pairs = [];
    for (const [key, value] of Object.entries(env)) {
        const v = String(value ?? '');
        const redacted = (0, config_1.shouldRedactEnvVar)(key, redactPatterns) ? '***REDACTED***' : v;
        pairs.push(`${key}=${redacted}`);
    }
    if (pairs.length === 0) {
        return undefined;
    }
    pairs.sort();
    const block = pairs.join('\n');
    return crypto.createHash('sha256').update(block, 'utf-8').digest('hex').slice(0, 12);
}
function hashFileContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}
function readAndHashConfigFile(workspaceFolder, relativePath) {
    try {
        const absPath = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, relativePath).fsPath;
        const buf = fs.readFileSync(absPath);
        return hashFileContent(buf);
    }
    catch {
        return undefined;
    }
}
exports.environmentSnapshotProvider = {
    id: 'environment',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { sessionContext, workspaceFolder, config } = context;
        const { includeEnvChecksum, configFiles, includeInHeader } = config.integrationsEnvironment;
        const lines = [];
        const payload = {};
        if (includeEnvChecksum) {
            const env = sessionContext.configuration?.env;
            const sum = env ? envChecksum(env, config.redactEnvVars) : undefined;
            if (sum) {
                lines.push(`Env checksum:   sha256:${sum}`);
                payload.envChecksum = sum;
            }
        }
        const configChecksums = {};
        for (const rel of configFiles) {
            const hash = readAndHashConfigFile(workspaceFolder, rel);
            if (hash) {
                configChecksums[rel] = hash;
                if (includeInHeader) {
                    lines.push(`Config ${rel}:  sha256:${hash}`);
                }
            }
        }
        if (Object.keys(configChecksums).length > 0) {
            payload.configChecksums = configChecksums;
        }
        if (lines.length === 0) {
            return undefined;
        }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'environment', payload },
        ];
    },
};
//# sourceMappingURL=environment-snapshot.js.map