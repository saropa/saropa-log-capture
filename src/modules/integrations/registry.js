"use strict";
/**
 * Registry for integration providers. Called from session-lifecycle: getHeaderContributions
 * before LogSession.start(), runOnSessionStartAsync after start (optionally merges async
 * header + meta when options provided), runOnSessionEnd during finalizeSession to merge
 * meta and write sidecar files.
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
exports.IntegrationRegistry = void 0;
const vscode = __importStar(require("vscode"));
function collectProviderEndContributions(p, context, metaOut, sidecarOut) {
    return Promise.resolve(p.onSessionEnd(context)).then(contributions => {
        if (!contributions) {
            return { contributed: false };
        }
        let contributed = false;
        for (const c of contributions) {
            if (c.kind === 'meta') {
                metaOut.push(c);
                contributed = true;
            }
            if (c.kind === 'sidecar') {
                sidecarOut.push(c);
                contributed = true;
            }
        }
        return { contributed };
    }).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        context.outputChannel.appendLine(`[${p.id}] onSessionEnd failed: ${msg}`);
        return { contributed: false };
    });
}
class IntegrationRegistry {
    providers = [];
    /** Keyed by log file path; one entry per session. Async contributions apply to this session's log; entry is removed in runOnSessionEnd. */
    pendingAsyncByLogUri = new Map();
    /** Register a provider. Called once from extension-activation for each built-in provider. */
    register(provider) {
        if (this.providers.some(p => p.id === provider.id)) {
            return;
        }
        this.providers.push(provider);
    }
    unregister(id) {
        const i = this.providers.findIndex(p => p.id === id);
        if (i !== -1) {
            this.providers.splice(i, 1);
        }
    }
    /** Returns header lines and contributor ids (sync). Call before LogSession.start(). Never throws; provider errors are logged and skipped.
     * Note: isEnabled may return Promise<boolean> per API; this path treats non-boolean as false (sync only). */
    getHeaderContributions(context) {
        const lines = [];
        const contributorIds = [];
        for (const p of this.providers) {
            let enabled;
            try {
                const result = p.isEnabled(context);
                enabled = typeof result === 'boolean' ? result : false;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] isEnabled failed: ${msg}`);
                continue;
            }
            if (!enabled) {
                continue;
            }
            const sync = p.onSessionStartSync;
            if (!sync) {
                continue;
            }
            let contributions;
            try {
                contributions = sync(context);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] onSessionStartSync failed: ${msg}`);
                continue;
            }
            if (!contributions) {
                continue;
            }
            let contributed = false;
            for (const c of contributions) {
                if (c.kind === 'header' && c.lines.length) {
                    lines.push(...c.lines);
                    contributed = true;
                }
            }
            if (contributed) {
                contributorIds.push(p.id);
            }
        }
        return { lines, contributorIds };
    }
    /** Ids of providers that contributed in the last runOnSessionEnd (for status bar). */
    lastEndContributorIds = [];
    /**
     * Runs all enabled providers' onSessionEnd, merges meta into SessionMeta.integrations,
     * and writes sidecar files. Logs errors and continues; never throws.
     */
    async runOnSessionEnd(context, metadataStore) {
        const metaContributions = [];
        const sidecarContributions = [];
        const contributorIds = [];
        const pending = this.pendingAsyncByLogUri.get(context.logUri.fsPath);
        if (pending?.pendingAsyncMeta.length) {
            metaContributions.push(...pending.pendingAsyncMeta);
        }
        this.pendingAsyncByLogUri.delete(context.logUri.fsPath);
        for (const p of this.providers) {
            const enabled = await Promise.resolve(p.isEnabled(context));
            if (!enabled || !p.onSessionEnd) {
                continue;
            }
            const result = await collectProviderEndContributions(p, context, metaContributions, sidecarContributions);
            if (result.contributed) {
                contributorIds.push(p.id);
            }
        }
        this.lastEndContributorIds = contributorIds;
        if (metaContributions.length > 0) {
            try {
                const meta = await metadataStore.loadMetadata(context.logUri);
                if (!meta.integrations) {
                    meta.integrations = {};
                }
                for (const c of metaContributions) {
                    const payload = c.payload;
                    const wrapped = typeof payload === 'object' && payload !== null
                        ? { ...payload }
                        : { value: payload };
                    wrapped.capturedAt = context.sessionEndTime;
                    wrapped.sessionWindow = {
                        start: context.sessionStartTime,
                        end: context.sessionEndTime,
                    };
                    meta.integrations[c.key] = wrapped;
                }
                await metadataStore.saveMetadata(context.logUri, meta);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`Integration meta save failed: ${msg}`);
            }
        }
        for (const c of sidecarContributions) {
            try {
                const uri = vscode.Uri.joinPath(context.logDirUri, c.filename);
                const buf = typeof c.content === 'string'
                    ? Buffer.from(c.content, 'utf-8')
                    : c.content;
                await vscode.workspace.fs.writeFile(uri, buf);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`Sidecar write failed (${c.filename}): ${msg}`);
            }
        }
        return { contributorIds };
    }
    getLastEndContributorIds() {
        return [...this.lastEndContributorIds];
    }
    /** Runs onSessionStartAsync for all enabled providers. When options are provided, async contributions (header + meta) are applied and merged at session end. */
    runOnSessionStartAsync(context, options) {
        if (options) {
            this.pendingAsyncByLogUri.set(options.logSession.fileUri.fsPath, {
                logSession: options.logSession,
                pendingAsyncMeta: options.pendingAsyncMeta,
            });
        }
        for (const p of this.providers) {
            Promise.resolve(p.isEnabled(context)).then(enabled => {
                if (!enabled || !p.onSessionStartAsync) {
                    return;
                }
                return p.onSessionStartAsync(context);
            }).then(contributions => {
                if (!contributions || !options) {
                    return;
                }
                const pending = this.pendingAsyncByLogUri.get(options.logSession.fileUri.fsPath);
                if (!pending) {
                    return;
                }
                for (const c of contributions) {
                    if (c.kind === 'header' && c.lines.length) {
                        pending.logSession.appendHeaderLines(c.lines);
                    }
                    if (c.kind === 'meta') {
                        pending.pendingAsyncMeta.push(c);
                    }
                }
            }).catch(err => {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] onSessionStartAsync failed: ${msg}`);
            });
        }
    }
}
exports.IntegrationRegistry = IntegrationRegistry;
//# sourceMappingURL=registry.js.map