"use strict";
/**
 * Built-in integration provider: pulls Drift Advisor snapshot via extension API
 * (`getSessionSnapshot`) or from `.saropa/drift-advisor-session.json` when the API
 * is missing. Contributes meta key `saropa-drift-advisor` and `{baseFileName}.drift-advisor.json`.
 *
 * When Drift Advisor also registers `saropa-drift-advisor` via registerIntegrationProvider,
 * that provider runs later and overwrites meta/sidecar (last writer wins).
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
exports.driftAdvisorBuiltinProvider = void 0;
const vscode = __importStar(require("vscode"));
const safe_json_1 = require("../../misc/safe-json");
const drift_advisor_constants_1 = require("../drift-advisor-constants");
const drift_advisor_include_level_1 = require("../drift-advisor-include-level");
const drift_advisor_snapshot_map_1 = require("./drift-advisor-snapshot-map");
function adapterOn(context) {
    return (context.config.integrationsAdapters ?? []).includes('driftAdvisor');
}
function readDriftIncludeInLogCaptureSession(folder) {
    const raw = vscode.workspace
        .getConfiguration(drift_advisor_include_level_1.DRIFT_ADVISOR_CONFIG_SECTION, folder.uri)
        .get(drift_advisor_include_level_1.DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY);
    return (0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)(raw);
}
function sessionFileUri(folder) {
    return vscode.Uri.joinPath(folder.uri, ...drift_advisor_constants_1.DRIFT_ADVISOR_SESSION_FILE_SEGMENTS);
}
async function sessionFileExists(folder) {
    try {
        await vscode.workspace.fs.stat(sessionFileUri(folder));
        return true;
    }
    catch {
        return false;
    }
}
function extensionHasApi(exports) {
    if (!exports || typeof exports !== 'object') {
        return false;
    }
    const g = exports.getSessionSnapshot;
    return typeof g === 'function';
}
async function withTimeoutNull(p, ms) {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), ms);
        p.then((v) => {
            clearTimeout(t);
            resolve(v);
        }).catch(() => {
            clearTimeout(t);
            resolve(null);
        });
    });
}
async function trySnapshotFromExtension(outputChannel) {
    const ext = vscode.extensions.getExtension(drift_advisor_constants_1.DRIFT_ADVISOR_EXTENSION_ID);
    if (!ext) {
        return null;
    }
    try {
        // Bound extension activation: even if activation is slow, session-end should not block indefinitely.
        await Promise.race([
            ext.activate(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), drift_advisor_constants_1.DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS);
            }),
        ]);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[driftAdvisorBuiltin] Drift Advisor activate failed: ${msg}`);
        return null;
    }
    if (!extensionHasApi(ext.exports)) {
        return null;
    }
    const raw = await withTimeoutNull(Promise.resolve(ext.exports.getSessionSnapshot()), drift_advisor_constants_1.DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS);
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    return raw;
}
async function trySnapshotFromFile(folder, outputChannel) {
    const uri = sessionFileUri(folder);
    try {
        const buf = await vscode.workspace.fs.readFile(uri);
        const parsed = (0, safe_json_1.safeParseJSON)(Buffer.from(buf));
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return parsed;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[driftAdvisorBuiltin] read session file failed: ${msg}`);
        return null;
    }
}
exports.driftAdvisorBuiltinProvider = {
    id: 'driftAdvisorBuiltin',
    isEnabled(context) {
        if (!adapterOn(context)) {
            return false;
        }
        // Match Drift bridge: only run built-in meta/sidecar path when Drift setting is `full`.
        const includeLevel = readDriftIncludeInLogCaptureSession(context.workspaceFolder);
        if (!(0, drift_advisor_include_level_1.driftBuiltinContributesMetaSidecar)(includeLevel)) {
            return false;
        }
        const ext = vscode.extensions.getExtension(drift_advisor_constants_1.DRIFT_ADVISOR_EXTENSION_ID);
        if (ext) {
            return true;
        }
        return sessionFileExists(context.workspaceFolder);
    },
    async onSessionEnd(context) {
        if (!adapterOn(context)) {
            return undefined;
        }
        const includeLevel = readDriftIncludeInLogCaptureSession(context.workspaceFolder);
        if (!(0, drift_advisor_include_level_1.driftBuiltinContributesMetaSidecar)(includeLevel)) {
            return undefined;
        }
        let snap = await trySnapshotFromExtension(context.outputChannel);
        snap ??= await trySnapshotFromFile(context.workspaceFolder, context.outputChannel);
        if (!snap) {
            return undefined;
        }
        const metaPayload = (0, drift_advisor_snapshot_map_1.snapshotToMetaPayload)(snap);
        const sidecarObj = (0, drift_advisor_snapshot_map_1.snapshotToSidecarObject)(snap);
        const sidecarName = `${context.baseFileName}.drift-advisor.json`;
        try {
            const contributions = [
                { kind: 'meta', key: drift_advisor_constants_1.DRIFT_ADVISOR_META_KEY, payload: metaPayload },
                {
                    kind: 'sidecar',
                    filename: sidecarName,
                    content: JSON.stringify(sidecarObj, null, 2),
                    contentType: 'json',
                },
            ];
            return contributions;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[driftAdvisorBuiltin] build contributions failed: ${msg}`);
            return undefined;
        }
    },
};
//# sourceMappingURL=drift-advisor-builtin.js.map