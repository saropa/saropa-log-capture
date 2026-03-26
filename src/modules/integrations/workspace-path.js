"use strict";
/**
 * Workspace path resolution for integrations.
 * Uses Uri.joinPath for workspace-relative paths so resolution is correct
 * in Remote - SSH, WSL, and Dev Containers (Task 90).
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
exports.substituteWorkspaceFolder = substituteWorkspaceFolder;
exports.resolveWorkspaceFileUri = resolveWorkspaceFileUri;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Substitute ${workspaceFolder} in a path template with the workspace root path.
 * Used by integrations that accept path settings with variable substitution.
 */
function substituteWorkspaceFolder(template, workspaceFolder) {
    const workspacePath = resolveWorkspaceFileUri(workspaceFolder, '.').fsPath;
    return path.normalize(template.replace(/\$\{workspaceFolder\}/gi, workspacePath));
}
/**
 * Resolve a path (absolute or workspace-relative) to a file URI.
 * Relative paths are normalized with forward slashes and resolved via
 * workspaceFolder.uri so they work in remote workspaces.
 */
function resolveWorkspaceFileUri(workspaceFolder, pathOrRelative) {
    return path.isAbsolute(pathOrRelative)
        ? vscode.Uri.file(pathOrRelative)
        : vscode.Uri.joinPath(workspaceFolder.uri, pathOrRelative.replace(/\\/g, '/'));
}
//# sourceMappingURL=workspace-path.js.map