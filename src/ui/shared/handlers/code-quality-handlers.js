"use strict";
/**
 * Handlers for code quality popover (show quality for frame).
 * Loads quality payload from session meta or from the log's .quality.json sidecar,
 * resolves the file for the selected line, and posts codeQualityPopoverData to the webview.
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
exports.handleCodeQualityForFrameRequest = handleCodeQualityForFrameRequest;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const session_metadata_1 = require("../../../modules/session/session-metadata");
const quality_types_1 = require("../../../modules/integrations/providers/quality-types");
const safe_json_1 = require("../../../modules/misc/safe-json");
const source_linker_1 = require("../../../modules/source/source-linker");
const l10n_1 = require("../../../l10n");
/** Find best-matching file key in payload.files for a given source path. */
function findFileKey(files, sourcePath) {
    const norm = (0, quality_types_1.normalizeForLookup)(sourcePath);
    if (!norm) {
        return undefined;
    }
    const keys = Object.keys(files);
    const exact = keys.find(k => (0, quality_types_1.normalizeForLookup)(k) === norm);
    if (exact) {
        return exact;
    }
    const basename = path.basename(sourcePath).toLowerCase();
    const byBasename = keys.filter(k => path.basename(k).toLowerCase() === basename);
    if (byBasename.length === 1) {
        return byBasename[0];
    }
    const suffixMatch = keys.find(k => norm.endsWith((0, quality_types_1.normalizeForLookup)(k)) || (0, quality_types_1.normalizeForLookup)(k).endsWith(norm));
    return suffixMatch;
}
/** Load code quality payload from meta or from quality.json sidecar. */
async function loadCodeQualityPayload(logUri) {
    const store = new session_metadata_1.SessionMetadataStore();
    const meta = await store.loadMetadata(logUri);
    const fromMeta = meta.integrations?.codeQuality;
    if (fromMeta && typeof fromMeta === 'object' && fromMeta.files && typeof fromMeta.files === 'object') {
        return fromMeta;
    }
    const logDir = path.dirname(logUri.fsPath);
    const baseFileName = path.basename(logUri.fsPath);
    const qualityPath = path.join(logDir, `${baseFileName}.quality.json`);
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(qualityPath));
        const data = (0, safe_json_1.parseJSONOrDefault)(Buffer.from(content).toString('utf-8'), {});
        if (data?.files && typeof data.files === 'object') {
            return data;
        }
    }
    catch {
        // ignore
    }
    return undefined;
}
/**
 * Handle showCodeQualityForFrame: load quality data, resolve file for the line, post popover data.
 */
async function handleCodeQualityForFrameRequest(logUri, lineIndex, lineText, post) {
    if (!logUri) {
        post({ type: 'codeQualityPopoverData', error: (0, l10n_1.t)('msg.noActiveSession') });
        return;
    }
    const sourceRef = (0, source_linker_1.extractSourceReference)(lineText);
    const sourcePath = sourceRef?.filePath;
    if (!sourcePath) {
        post({ type: 'codeQualityPopoverData', lineIndex, error: 'No source file reference in this line.' });
        return;
    }
    try {
        const payload = await loadCodeQualityPayload(logUri);
        if (!payload) {
            post({ type: 'codeQualityPopoverData', lineIndex, error: (0, l10n_1.t)('msg.noQualityReportFound') });
            return;
        }
        const fileKey = findFileKey(payload.files, sourcePath);
        if (!fileKey) {
            post({
                type: 'codeQualityPopoverData',
                lineIndex,
                filePath: sourcePath,
                error: 'No quality data for this file.',
            });
            return;
        }
        const metrics = payload.files[fileKey];
        post({
            type: 'codeQualityPopoverData',
            lineIndex,
            filePath: fileKey,
            metrics: metrics ?? undefined,
            summary: payload.summary,
        });
    }
    catch {
        post({ type: 'codeQualityPopoverData', lineIndex, error: (0, l10n_1.t)('msg.noQualityReportFound') });
    }
}
//# sourceMappingURL=code-quality-handlers.js.map