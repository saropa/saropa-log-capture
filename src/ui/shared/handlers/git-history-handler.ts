/**
 * Handler for the "View Git History" line action (plan 055 Stage 2): for a log line that carries a
 * source reference, resolve the file in the workspace and post git blame for the referenced line plus
 * the file's recent commits, rendered in the context popover.
 *
 * The editor-native angle the log itself can't give: who last touched this line and what changed in
 * the file lately. All git/IO is best-effort — a missing file, untracked tree, or no-git degrades to
 * an error string in the popover, never throws.
 */

import * as vscode from 'vscode';
import { extractSourceReference } from '../../../modules/source/source-linker';
import { findInWorkspace, getGitHistory, type GitCommit } from '../../../modules/misc/workspace-analyzer';
import { getGitBlame, type BlameLine } from '../../../modules/git/git-blame';

export type PostFn = (msg: unknown) => void;

/** Payload posted to the webview's git-history popover. `error` and the data fields are exclusive. */
interface GitHistoryPopoverData {
    readonly type: 'gitHistoryPopoverData';
    readonly lineIndex: number;
    readonly filePath?: string;
    readonly line?: number;
    readonly blame?: BlameLine;
    readonly commits?: readonly GitCommit[];
    readonly error?: string;
}

const RECENT_COMMIT_COUNT = 5;

/**
 * Resolve the line's source file and post blame + recent commits. `lineText` (not a host-side line
 * store) is the source of the reference because the webview owns the rendered rows; the host only
 * sees the text it is handed, exactly like the code-quality handler.
 */
export async function handleGitHistoryForLine(
    lineIndex: number,
    lineText: string,
    post: PostFn,
): Promise<void> {
    const ref = extractSourceReference(lineText);
    if (!ref?.filePath) {
        post({ type: 'gitHistoryPopoverData', lineIndex, error: 'No source file reference in this line.' } satisfies GitHistoryPopoverData);
        return;
    }
    try {
        const uri = await findInWorkspace(ref.filePath);
        if (!uri) {
            post({ type: 'gitHistoryPopoverData', lineIndex, filePath: ref.filePath, error: 'File not found in workspace.' } satisfies GitHistoryPopoverData);
            return;
        }
        // Blame the referenced line; recent commits for the whole file. Independent, so run together.
        const [blame, commits] = await Promise.all([
            getGitBlame(uri, ref.line).catch(() => undefined),
            getGitHistory(uri, RECENT_COMMIT_COUNT).catch(() => [] as GitCommit[]),
        ]);
        post({
            type: 'gitHistoryPopoverData',
            lineIndex,
            filePath: vscode.workspace.asRelativePath(uri, false),
            line: ref.line,
            blame,
            commits,
        } satisfies GitHistoryPopoverData);
    } catch {
        post({ type: 'gitHistoryPopoverData', lineIndex, error: 'Git lookup failed.' } satisfies GitHistoryPopoverData);
    }
}
