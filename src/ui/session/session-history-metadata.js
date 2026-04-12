"use strict";
/**
 * Metadata loading and sidecar merging for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
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
exports.loadBatch = loadBatch;
const vscode = __importStar(require("vscode"));
const session_metadata_1 = require("../../modules/session/session-metadata");
const session_history_helpers_1 = require("./session-history-helpers");
/** Load metadata for all files with bounded concurrency (max 8 parallel). */
async function loadBatch(target, logDir, files, opts) {
    const { centralMeta, onItemLoaded } = opts;
    const results = new Array(files.length);
    const limit = 8;
    let index = 0;
    const run = async () => {
        while (index < files.length) {
            const i = index++;
            results[i] = await loadMetadata(target, logDir, files[i], centralMeta);
            onItemLoaded?.(results[i], i);
        }
    };
    const count = Math.min(limit, files.length);
    await Promise.all(Array.from({ length: count }, () => run()));
    return results;
}
/** Load and cache metadata for a single session file. */
async function loadMetadata(target, logDir, filename, centralMeta) {
    const uri = vscode.Uri.joinPath(logDir, filename);
    const stat = await vscode.workspace.fs.stat(uri);
    const cacheKey = `${uri.toString()}|${stat.mtime}|${stat.size}`;
    const cached = target.metaCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const relKey = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
    const sidecar = centralMeta.get(relKey) ?? {};
    const hasCachedSev = sidecar.errorCount !== undefined && sidecar.fwCount !== undefined;
    let meta = { uri, filename, size: stat.size, mtime: stat.mtime };
    meta = await (0, session_history_helpers_1.parseHeader)(uri, meta, hasCachedSev);
    meta = applySidecar(target, meta, sidecar, { uri, hasCachedSev });
    target.metaCache.set(cacheKey, meta);
    return meta;
}
/** True when session meta has performance integration data (snapshot or samples). */
function hasPerformanceData(sidecar) {
    return (0, session_metadata_1.hasMeaningfulPerformanceData)(sidecar.integrations?.performance);
}
/** Merge sidecar metadata into the parsed session metadata. */
function applySidecar(target, meta, sidecar, ctx) {
    let result = meta;
    if (sidecar.displayName) {
        result = { ...result, displayName: sidecar.displayName };
    }
    if (sidecar.tags?.length) {
        result = { ...result, tags: sidecar.tags };
    }
    if (sidecar.autoTags?.length) {
        result = { ...result, autoTags: sidecar.autoTags };
    }
    if (sidecar.correlationTags?.length) {
        result = { ...result, correlationTags: sidecar.correlationTags };
    }
    if (sidecar.trashed) {
        result = { ...result, trashed: true };
    }
    if (hasPerformanceData(sidecar)) {
        result = { ...result, hasPerformanceData: true };
    }
    if (ctx.hasCachedSev) {
        return { ...result, errorCount: sidecar.errorCount, warningCount: sidecar.warningCount, perfCount: sidecar.perfCount, anrCount: sidecar.anrCount, fwCount: sidecar.fwCount, infoCount: sidecar.infoCount };
    }
    if (result.errorCount !== undefined) {
        const toSave = { ...sidecar, errorCount: result.errorCount, warningCount: result.warningCount, perfCount: result.perfCount, anrCount: result.anrCount, fwCount: result.fwCount, infoCount: result.infoCount };
        target.metaStore.saveMetadata(ctx.uri, toSave).catch(() => { });
    }
    return result;
}
//# sourceMappingURL=session-history-metadata.js.map