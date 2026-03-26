"use strict";
/**
 * Detects the nearest package root by walking up from a file to find
 * a manifest file (pubspec.yaml, package.json, Cargo.toml, etc.).
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
exports.detectPackageRoot = detectPackageRoot;
const vscode = __importStar(require("vscode"));
const manifestFiles = [
    'pubspec.yaml',
    'package.json',
    'Cargo.toml',
    'go.mod',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
];
/** Cache: file path → package root (or null if none found). */
const rootCache = new Map();
/** Walk up from fileUri to find the nearest ancestor with a package manifest. */
async function detectPackageRoot(fileUri, stopAt) {
    const cacheKey = fileUri.path;
    const cached = rootCache.get(cacheKey);
    if (cached !== undefined) {
        return cached ?? undefined;
    }
    const result = await walkForManifest(fileUri, stopAt);
    rootCache.set(cacheKey, result ?? null);
    return result;
}
async function walkForManifest(fileUri, stopAt) {
    let dir = vscode.Uri.joinPath(fileUri, '..');
    const stopPath = stopAt.path.toLowerCase();
    while (dir.path.toLowerCase().startsWith(stopPath)) {
        for (const name of manifestFiles) {
            const candidate = vscode.Uri.joinPath(dir, name);
            try {
                await vscode.workspace.fs.stat(candidate);
                return dir;
            }
            catch {
                // File doesn't exist — continue
            }
        }
        const parent = vscode.Uri.joinPath(dir, '..');
        if (parent.path === dir.path) {
            break;
        }
        dir = parent;
    }
    return undefined;
}
//# sourceMappingURL=package-detector.js.map