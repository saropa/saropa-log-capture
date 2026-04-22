"use strict";
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
exports.SessionMetadataStore = exports.isOurSidecar = exports.migrateAllSidecarsToCentral = exports.migrateSidecarsInDirectory = void 0;
exports.hasMeaningfulPerformanceData = hasMeaningfulPerformanceData;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const config_1 = require("../config/config");
const extension_logger_1 = require("../misc/extension-logger");
const session_metadata_io_1 = require("./session-metadata-io");
// MetaMap type imported from session-metadata-io.ts
/**
 * Whether performance integration payload contains meaningful session-level data.
 * Used for UI affordances (session badges/chips), so empty placeholder objects should not count.
 */
function hasMeaningfulPerformanceData(perf) {
    if (!perf || typeof perf !== 'object') {
        return false;
    }
    const data = perf;
    if (typeof data.samplesFile === 'string' && data.samplesFile.trim().length > 0) {
        return true;
    }
    const snap = data.snapshot;
    if (!snap || typeof snap !== 'object') {
        return false;
    }
    return (typeof snap.cpus === 'number' ||
        typeof snap.totalMemMb === 'number' ||
        typeof snap.freeMemMb === 'number' ||
        typeof snap.processMemMb === 'number');
}
var session_metadata_migration_1 = require("./session-metadata-migration");
Object.defineProperty(exports, "migrateSidecarsInDirectory", { enumerable: true, get: function () { return session_metadata_migration_1.migrateSidecarsInDirectory; } });
Object.defineProperty(exports, "migrateAllSidecarsToCentral", { enumerable: true, get: function () { return session_metadata_migration_1.migrateAllSidecarsToCentral; } });
Object.defineProperty(exports, "isOurSidecar", { enumerable: true, get: function () { return session_metadata_migration_1.isOurSidecar; } });
/** Manages session metadata in <logDir>/.session-metadata.json (no sidecars in log dir). */
class SessionMetadataStore {
    /** URI of the central metadata file. Returns undefined if no workspace folder is available. */
    getMetaUri(logUri) {
        return (0, session_metadata_io_1.getCentralMetaUri)(logUri);
    }
    /** Load metadata for a log file from central store. Migrates legacy sidecar on first read. */
    async loadMetadata(logUri) {
        const centralUri = (0, session_metadata_io_1.getCentralMetaUri)(logUri);
        if (!centralUri) {
            return {};
        }
        const key = (0, session_metadata_io_1.relativeKey)(logUri);
        const data = await (0, session_metadata_io_1.readCentral)(centralUri);
        let meta = data[key] ? { ...data[key] } : {};
        if (Object.keys(meta).length === 0) {
            meta = await this.migrateSidecarToCentral(logUri, centralUri, key, data);
        }
        return meta;
    }
    async migrateSidecarToCentral(logUri, centralUri, key, data) {
        const sidecar = await (0, session_metadata_io_1.loadSidecar)(logUri);
        if (Object.keys(sidecar).length === 0) {
            return {};
        }
        data[key] = sidecar;
        await (0, session_metadata_io_1.writeCentral)(centralUri, data);
        try {
            await vscode.workspace.fs.delete((0, session_metadata_io_1.fallbackSidecarUri)(logUri));
        }
        catch { /* ignore */ }
        return sidecar;
    }
    /** Save metadata for a log file. Writes to central store only; never creates sidecar files. */
    async saveMetadata(logUri, meta) {
        const centralUri = (0, session_metadata_io_1.getCentralMetaUri)(logUri);
        if (!centralUri) {
            return;
        }
        const key = (0, session_metadata_io_1.relativeKey)(logUri);
        const data = await (0, session_metadata_io_1.readCentral)(centralUri);
        data[key] = meta;
        await (0, session_metadata_io_1.writeCentral)(centralUri, data);
    }
    /** Remove metadata for a log file (e.g. after permanent delete or rename). */
    async deleteMetadata(logUri) {
        const centralUri = (0, session_metadata_io_1.getCentralMetaUri)(logUri);
        if (!centralUri) {
            return;
        }
        const key = (0, session_metadata_io_1.relativeKey)(logUri);
        const data = await (0, session_metadata_io_1.readCentral)(centralUri);
        delete data[key];
        await (0, session_metadata_io_1.writeCentral)(centralUri, data);
    }
    async setDisplayName(logUri, name) {
        const meta = await this.loadMetadata(logUri);
        meta.displayName = name;
        await this.saveMetadata(logUri, meta);
    }
    async setTags(logUri, tags) {
        const meta = await this.loadMetadata(logUri);
        meta.tags = tags;
        await this.saveMetadata(logUri, meta);
    }
    async setAutoTags(logUri, autoTags) {
        const meta = await this.loadMetadata(logUri);
        meta.autoTags = autoTags;
        await this.saveMetadata(logUri, meta);
    }
    async setCorrelationTags(logUri, correlationTags) {
        const meta = await this.loadMetadata(logUri);
        meta.correlationTags = correlationTags;
        await this.saveMetadata(logUri, meta);
    }
    async setFingerprints(logUri, fingerprints) {
        const meta = await this.loadMetadata(logUri);
        meta.fingerprints = fingerprints;
        await this.saveMetadata(logUri, meta);
    }
    async setPerfFingerprints(logUri, perfFingerprints) {
        const meta = await this.loadMetadata(logUri);
        meta.perfFingerprints = perfFingerprints;
        await this.saveMetadata(logUri, meta);
    }
    async setDriftSqlFingerprintSummary(logUri, summary) {
        const meta = await this.loadMetadata(logUri);
        meta.driftSqlFingerprintSummary = summary;
        await this.saveMetadata(logUri, meta);
    }
    async setAppVersion(logUri, version) {
        const meta = await this.loadMetadata(logUri);
        meta.appVersion = version;
        await this.saveMetadata(logUri, meta);
    }
    async setTrashed(logUri, trashed) {
        const meta = await this.loadMetadata(logUri);
        if (trashed) {
            meta.trashed = true;
        }
        else {
            delete meta.trashed;
        }
        await this.saveMetadata(logUri, meta);
    }
    async addAnnotation(logUri, annotation) {
        const meta = await this.loadMetadata(logUri);
        if (!meta.annotations) {
            meta.annotations = [];
        }
        meta.annotations.push(annotation);
        await this.saveMetadata(logUri, meta);
    }
    async getAnnotations(logUri) {
        const meta = await this.loadMetadata(logUri);
        return meta.annotations ?? [];
    }
    /**
     * Rename the log file on disk and move its metadata to the new key.
     * @returns The new URI of the renamed log file, or the original if rename failed.
     */
    async renameLogFile(logUri, newDisplayName) {
        const oldPath = logUri.fsPath;
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const lastSepIndex = oldPath.lastIndexOf(separator);
        const dirPath = oldPath.substring(0, lastSepIndex + 1);
        const oldFilename = oldPath.substring(lastSepIndex + 1);
        const prefixMatch = oldFilename.match(/^(\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const safeName = newDisplayName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
        if (!safeName) {
            return logUri;
        }
        const extMatch = oldFilename.match(/\.[a-z]+$/i);
        const ext = extMatch ? extMatch[0] : '.log';
        const newFilename = `${prefix}${safeName}${ext}`;
        if (newFilename === oldFilename) {
            return logUri;
        }
        const newLogUri = vscode.Uri.file(`${dirPath}${newFilename}`);
        try {
            try {
                await vscode.workspace.fs.stat(newLogUri);
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.cannotRenameExists', newFilename));
                return logUri;
            }
            catch { /* good */ }
            const meta = await this.loadMetadata(logUri);
            await vscode.workspace.fs.rename(logUri, newLogUri);
            if (Object.keys(meta).length > 0) {
                await this.saveMetadata(newLogUri, meta);
                await this.deleteMetadata(logUri);
            }
            return newLogUri;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            (0, extension_logger_1.logExtensionError)('renameLogFile', err instanceof Error ? err : new Error(msg));
            vscode.window.showErrorMessage((0, l10n_1.t)('msg.failedRenameLogFile', msg));
            return logUri;
        }
    }
    /**
     * Set (or clear when `groupId` is undefined) the `groupId` on a single entry.
     * Used by ungroup flows on a per-file basis. For bulk stamping use `stampGroupIdBatch`.
     */
    async setGroupId(logUri, groupId) {
        const meta = await this.loadMetadata(logUri);
        if (groupId === undefined) {
            delete meta.groupId;
        }
        else {
            meta.groupId = groupId;
        }
        await this.saveMetadata(logUri, meta);
    }
    /**
     * Stamp the same `groupId` on many entries in one read-modify-write.
     *
     * Skips entries that already carry a different `groupId` (respects the
     * "never re-claim a grouped file" rule). Returns the list of URIs that were
     * actually stamped so the caller can log or display the claim outcome.
     *
     * `groupId === undefined` clears the field on every listed URI, used by the
     * bulk-ungroup command. When clearing, the "respect existing groupId" guard
     * is intentionally skipped \u2014 callers of the clear path are explicitly
     * removing a known group.
     */
    async stampGroupIdBatch(logUris, groupId) {
        if (logUris.length === 0) {
            return [];
        }
        const centralUri = (0, session_metadata_io_1.getCentralMetaUri)(logUris[0]);
        if (!centralUri) {
            return [];
        }
        const data = await (0, session_metadata_io_1.readCentral)(centralUri);
        const stamped = [];
        for (const logUri of logUris) {
            const key = (0, session_metadata_io_1.relativeKey)(logUri);
            const existing = data[key] ? { ...data[key] } : {};
            if (groupId === undefined) {
                if (existing.groupId === undefined) {
                    continue;
                }
                delete existing.groupId;
            }
            else {
                // Respect the "never re-claim" rule: skip files already in a different group.
                if (existing.groupId !== undefined && existing.groupId !== groupId) {
                    continue;
                }
                if (existing.groupId === groupId) {
                    continue;
                } // no-op when already stamped
                existing.groupId = groupId;
            }
            data[key] = existing;
            stamped.push(logUri);
        }
        if (stamped.length > 0) {
            await (0, session_metadata_io_1.writeCentral)(centralUri, data);
        }
        return stamped;
    }
    /**
     * Read the central metadata file once and return all entries keyed by relative path.
     * Used by SessionHistoryProvider to avoid N reads per refresh cycle.
     */
    async loadAllMetadata(logDir) {
        const folder = vscode.workspace.getWorkspaceFolder(logDir) ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return new Map();
        }
        const centralUri = vscode.Uri.joinPath((0, config_1.getLogDirectoryUri)(folder), '.session-metadata.json');
        const data = await (0, session_metadata_io_1.readCentral)(centralUri);
        return new Map(Object.entries(data));
    }
}
exports.SessionMetadataStore = SessionMetadataStore;
//# sourceMappingURL=session-metadata.js.map