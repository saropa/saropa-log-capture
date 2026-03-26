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
exports.readDirectoryIfExistsAsDirectory = readDirectoryIfExistsAsDirectory;
/**
 * Safe directory listing for VS Code’s `FileSystem` API.
 *
 * ## Why this exists
 *
 * During extension activation we often need to scan optional folders (legacy Crashlytics
 * cache, empty `.saropa/cache/*`, etc.). The obvious approach is `readDirectory` inside
 * `try/catch`. On the extension host, a missing path can still produce a **noisy** Node-level
 * log (`readdir` / `scandir` + `ENOENT`) even though the rejection is handled. Callers that
 * care about a quiet developer console should **`stat` first** and only call
 * `readDirectory` when the URI exists and is a directory.
 *
 * ## Contract
 *
 * - **Missing path** → `[]` (no `readDirectory` call).
 * - **File or other non-directory** → `[]`.
 * - **Directory** → entries from `readDirectory`, or `[]` if listing fails (permissions,
 *   race with delete, etc.).
 *
 * This helper is synchronous with respect to ordering: `stat` completes before any
 * `readDirectory`. There is no recursion and no retry loop, so no recursion risk.
 */
const vscode = __importStar(require("vscode"));
/**
 * Return directory entries only when `uri` exists and is a directory; otherwise `[]`.
 * Never throws.
 */
async function readDirectoryIfExistsAsDirectory(fsApi, uri) {
    try {
        const st = await fsApi.stat(uri);
        if ((st.type & vscode.FileType.Directory) === 0) {
            return [];
        }
    }
    catch {
        return [];
    }
    try {
        return await fsApi.readDirectory(uri);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=vscode-fs-read-directory-safe.js.map