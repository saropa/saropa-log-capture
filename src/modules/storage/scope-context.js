"use strict";
/**
 * Builds scope context for the source scope filter. Computes active file path, workspace folder,
 * package root, and directory (normalized for cross-platform comparison). Called from
 * extension-activation on active editor change and pushed to the broadcaster for the webview.
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
exports.buildScopeContext = buildScopeContext;
const vscode = __importStar(require("vscode"));
const package_detector_1 = require("../misc/package-detector");
function normalizePath(uri) {
    return uri.path.replace(/\\/g, '/').toLowerCase();
}
/** Build scope context from the active text editor. */
async function buildScopeContext(editor) {
    if (!editor) {
        return { activeFilePath: null, workspaceFolder: null, packageRoot: null, activeDirectory: null };
    }
    const fileUri = editor.document.uri;
    const wsFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    const dirUri = vscode.Uri.joinPath(fileUri, '..');
    let packageRoot = null;
    if (wsFolder) {
        const pkgUri = await (0, package_detector_1.detectPackageRoot)(fileUri, wsFolder.uri);
        if (pkgUri) {
            packageRoot = normalizePath(pkgUri);
        }
    }
    return {
        activeFilePath: normalizePath(fileUri),
        workspaceFolder: wsFolder ? normalizePath(wsFolder.uri) : null,
        packageRoot,
        activeDirectory: normalizePath(dirUri),
    };
}
//# sourceMappingURL=scope-context.js.map