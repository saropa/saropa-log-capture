"use strict";
/**
 * Build/CI integration: file-based (last-build.json) or API-based (GitHub Actions,
 * Azure DevOps, GitLab CI). Adds last build status and link to header and meta.
 * API fetches run in onSessionStartAsync so they do not block session start.
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
exports.buildCiProvider = void 0;
exports.getBuildCiGithubToken = getBuildCiGithubToken;
exports.setBuildCiGithubToken = setBuildCiGithubToken;
exports.deleteBuildCiGithubToken = deleteBuildCiGithubToken;
exports.getBuildCiAzurePat = getBuildCiAzurePat;
exports.setBuildCiAzurePat = setBuildCiAzurePat;
exports.deleteBuildCiAzurePat = deleteBuildCiAzurePat;
exports.getBuildCiGitlabToken = getBuildCiGitlabToken;
exports.setBuildCiGitlabToken = setBuildCiGitlabToken;
exports.deleteBuildCiGitlabToken = deleteBuildCiGitlabToken;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
const safe_json_1 = require("../../misc/safe-json");
const build_ci_api_1 = require("./build-ci-api");
const MAX_BUILD_FILE_BYTES = 512 * 1024; // 512 KB
const SECRET_KEYS = {
    github: 'saropaLogCapture.buildCi.githubToken',
    azure: 'saropaLogCapture.buildCi.azurePat',
    gitlab: 'saropaLogCapture.buildCi.gitlabToken',
};
function isEnabled(context) {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('buildCi');
}
function getBuildInfoFromFile(workspaceFolder, relativePath, maxAgeMs) {
    try {
        if (!workspaceFolder?.uri) {
            return undefined;
        }
        const absPath = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, relativePath).fsPath;
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) {
            return undefined;
        }
        if (stat.size > MAX_BUILD_FILE_BYTES) {
            return undefined;
        }
        if (Date.now() - stat.mtimeMs > maxAgeMs) {
            return undefined;
        }
        const raw = fs.readFileSync(absPath, 'utf-8');
        const data = (0, safe_json_1.safeParseJSON)(raw);
        if (!data || typeof data !== 'object') {
            return undefined;
        }
        const status = data.status;
        if (status !== 'success' && status !== 'failure' && status !== 'cancelled') {
            return undefined;
        }
        return {
            status: status,
            buildId: typeof data.buildId === 'string' ? data.buildId : undefined,
            url: typeof data.url === 'string' ? data.url : undefined,
            commit: typeof data.commit === 'string' ? data.commit : undefined,
            conclusion: typeof data.conclusion === 'string' ? data.conclusion : undefined,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp : undefined,
        };
    }
    catch {
        return undefined;
    }
}
function contributionsFromBuildInfo(info) {
    const buildLabel = info.buildId ? ` (${info.buildId})` : '';
    const lines = [`Last build:     ${info.status}${buildLabel}`];
    if (info.url) {
        lines.push(`Build link:     ${info.url}`);
    }
    const payload = {
        status: info.status,
        buildId: info.buildId,
        url: info.url,
        commit: info.commit,
        conclusion: info.conclusion,
        timestamp: info.timestamp,
    };
    return [
        { kind: 'header', lines },
        { kind: 'meta', key: 'buildCi', payload },
    ];
}
async function getBuildCiGithubToken(extensionContext) {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.github) ?? undefined;
    }
    catch {
        return undefined;
    }
}
async function setBuildCiGithubToken(extensionContext, token) {
    await extensionContext.secrets.store(SECRET_KEYS.github, token);
}
async function deleteBuildCiGithubToken(extensionContext) {
    await extensionContext.secrets.delete(SECRET_KEYS.github);
}
async function getBuildCiAzurePat(extensionContext) {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.azure) ?? undefined;
    }
    catch {
        return undefined;
    }
}
async function setBuildCiAzurePat(extensionContext, pat) {
    await extensionContext.secrets.store(SECRET_KEYS.azure, pat);
}
async function deleteBuildCiAzurePat(extensionContext) {
    await extensionContext.secrets.delete(SECRET_KEYS.azure);
}
async function getBuildCiGitlabToken(extensionContext) {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.gitlab) ?? undefined;
    }
    catch {
        return undefined;
    }
}
async function setBuildCiGitlabToken(extensionContext, token) {
    await extensionContext.secrets.store(SECRET_KEYS.gitlab, token);
}
async function deleteBuildCiGitlabToken(extensionContext) {
    await extensionContext.secrets.delete(SECRET_KEYS.gitlab);
}
exports.buildCiProvider = {
    id: 'buildCi',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { source } = context.config.integrationsBuildCi;
        if (source !== 'file') {
            return undefined;
        }
        const { workspaceFolder, config } = context;
        const { buildInfoPath, fileMaxAgeMinutes } = config.integrationsBuildCi;
        const maxAgeMs = fileMaxAgeMinutes * 60 * 1000;
        const info = getBuildInfoFromFile(workspaceFolder, buildInfoPath, maxAgeMs);
        if (!info) {
            return undefined;
        }
        return contributionsFromBuildInfo(info);
    },
    async onSessionStartAsync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { source } = context.config.integrationsBuildCi;
        if (source === 'file') {
            return undefined;
        }
        const extCtx = context.extensionContext;
        if (!extCtx) {
            context.outputChannel.appendLine('[buildCi] API source requires extension context (SecretStorage).');
            return undefined;
        }
        const { outputChannel } = context;
        let info;
        try {
            if (source === 'github') {
                const token = await getBuildCiGithubToken(extCtx);
                info = await (0, build_ci_api_1.fetchGitHubActionsBuildInfo)(context, token);
            }
            else if (source === 'azure') {
                const pat = await getBuildCiAzurePat(extCtx);
                info = await (0, build_ci_api_1.fetchAzureBuildInfo)(context, pat);
            }
            else if (source === 'gitlab') {
                const token = await getBuildCiGitlabToken(extCtx);
                info = await (0, build_ci_api_1.fetchGitLabBuildInfo)(context, token);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`[buildCi] onSessionStartAsync failed: ${msg}`);
            return undefined;
        }
        if (!info) {
            return undefined;
        }
        return contributionsFromBuildInfo(info);
    },
};
//# sourceMappingURL=build-ci.js.map