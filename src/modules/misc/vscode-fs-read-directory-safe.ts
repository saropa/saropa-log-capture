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
import * as vscode from 'vscode';

/**
 * Return directory entries only when `uri` exists and is a directory; otherwise `[]`.
 * Never throws.
 */
export async function readDirectoryIfExistsAsDirectory(
    fsApi: vscode.FileSystem,
    uri: vscode.Uri,
): Promise<[string, vscode.FileType][]> {
    try {
        const st = await fsApi.stat(uri);
        if ((st.type & vscode.FileType.Directory) === 0) {
            return [];
        }
    } catch {
        return [];
    }
    try {
        return await fsApi.readDirectory(uri);
    } catch {
        return [];
    }
}
