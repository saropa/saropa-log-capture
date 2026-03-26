"use strict";
/**
 * .slc session bundle export and import. Export produces a ZIP with manifest.json,
 * metadata.json, log file(s), and integration sidecar files; import extracts into
 * the workspace log directory and merges metadata.
 * v3: investigation bundles (type 'investigation') with investigation.json and sources/.
 * Invoked by exportSlc command and session panel "Export as SLC".
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportInvestigationToBuffer = exports.exportInvestigationToSlc = exports.exportSessionToSlc = void 0;
exports.isSlcManifestValid = isSlcManifestValid;
exports.importSlcBundle = importSlcBundle;
const vscode = __importStar(require("vscode"));
const jszip_1 = __importDefault(require("jszip"));
const l10n_1 = require("../../l10n");
const slc_types_1 = require("./slc-types");
const slc_session_1 = require("./slc-session");
Object.defineProperty(exports, "exportSessionToSlc", { enumerable: true, get: function () { return slc_session_1.exportSessionToSlc; } });
const slc_investigation_1 = require("./slc-investigation");
Object.defineProperty(exports, "exportInvestigationToSlc", { enumerable: true, get: function () { return slc_investigation_1.exportInvestigationToSlc; } });
Object.defineProperty(exports, "exportInvestigationToBuffer", { enumerable: true, get: function () { return slc_investigation_1.exportInvestigationToBuffer; } });
/** Returns true if manifest has supported version and required fields. */
function isSlcManifestValid(manifest) {
    if (manifest.version === slc_types_1.MANIFEST_VERSION_INVESTIGATION && manifest.type === 'investigation') {
        return !!(manifest.investigation?.name &&
            Array.isArray(manifest.investigation.sources));
    }
    const validVersion = manifest.version === 1 || manifest.version === 2;
    return validVersion && typeof manifest.mainLog === 'string' && manifest.mainLog.length > 0;
}
function isInvestigationManifest(m) {
    return m.version === slc_types_1.MANIFEST_VERSION_INVESTIGATION && m.type === 'investigation' && !!m.investigation;
}
/**
 * Import a .slc bundle: dispatches to session or investigation import based on manifest type.
 */
async function importSlcBundle(slcUri) {
    let raw;
    try {
        raw = await vscode.workspace.fs.readFile(slcUri);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportReadFailed', msg));
        return undefined;
    }
    let zip;
    try {
        zip = await jszip_1.default.loadAsync(raw);
    }
    catch {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportInvalidManifest'));
        return undefined;
    }
    const manifestFile = zip.file(slc_types_1.MANIFEST_FILENAME);
    if (!manifestFile) {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportNoManifest'));
        return undefined;
    }
    const manifestJson = await manifestFile.async('string');
    let manifest;
    try {
        manifest = JSON.parse(manifestJson);
    }
    catch {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportInvalidManifest'));
        return undefined;
    }
    if (!isSlcManifestValid(manifest)) {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportInvalidManifest'));
        return undefined;
    }
    if (isInvestigationManifest(manifest)) {
        return (0, slc_investigation_1.importInvestigationFromSlc)(zip, manifest);
    }
    return (0, slc_session_1.importSessionFromSlc)(zip, manifest);
}
//# sourceMappingURL=slc-bundle.js.map