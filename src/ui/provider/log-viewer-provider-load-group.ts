/**
 * Session-group merged-load helpers.
 *
 * `loadFromFiles` in log-viewer-provider.ts uses these functions to pull extra
 * group members into the viewer after the primary has been loaded via the normal
 * single-file pipeline. Members whose filenames share the primary's basename are
 * auto-merged by the existing sidecar logic in executeLoadContent; only the
 * non-sidecar members (typically from a manual cross-basename grouping) need
 * this explicit append path.
 *
 * Kept separate from log-viewer-provider-load-helpers.ts to avoid growing that
 * file past the 300-line limit.
 */

import * as vscode from "vscode";
import {
    parseExternalSidecarToPending,
    sourceTagForGroupMember,
    SOURCE_EXTERNAL_PREFIX,
} from "../viewer/viewer-file-loader-sources";
import { getMainBaseFromFsPath } from "./log-viewer-provider-load-helpers";

/** Target contract for the merge flow \u2014 keeps this module decoupled from the class shape. */
export interface MergedLoadTarget extends AppendGroupMemberTarget {
    loadFromFile(uri: vscode.Uri): Promise<void>;
    setFilename(name: string): void;
}

/**
 * Sort the URIs by mtime ascending, treat the earliest as the primary, load it
 * via the normal single-file pipeline, then append every non-sidecar member.
 *
 * Sidecar members (filenames sharing the primary's basename plus a `.label.log`
 * suffix) are skipped because `executeLoadContent` already merged them during
 * the primary load. Every other member is read explicitly and appended with a
 * filename-derived source tag so the existing source-tag filter shows it as a
 * distinct stream.
 *
 * Always finishes by updating the viewer title to a composite label so users
 * know they're looking at a merged group.
 */
export async function mergedLoadFromFiles(
    target: MergedLoadTarget,
    uris: readonly vscode.Uri[],
): Promise<void> {
    if (uris.length === 0) { return; }
    if (uris.length === 1) { return target.loadFromFile(uris[0]); }
    const sorted = await sortByMtimeAscending(uris);
    const primary = sorted[0];
    await target.loadFromFile(primary);
    const primaryBase = getMainBaseFromFsPath(primary.fsPath);
    for (let i = 1; i < sorted.length; i++) {
        const member = sorted[i];
        const memberName = member.fsPath.split(/[\\/]/).pop() ?? "";
        // Skip auto-merged sidecars (filename of the form `<primaryBase>.<label>.log`).
        if (primaryBase && memberName.startsWith(primaryBase + ".") && memberName.endsWith(".log")) { continue; }
        try {
            await appendGroupMember(target, member, primaryBase ?? "");
        } catch (err) {
            // Per-member failure must not abort the merged view.
            const msg = err instanceof Error ? err.message : String(err);
            target.postMessage({ type: "addLine", line: `[session-group] failed to append ${memberName}: ${msg}` });
        }
    }
    target.setFilename(`Session Group (${sorted.length} files)`);
}

/**
 * Stat each URI and return them ordered by ascending mtime. URIs whose stat
 * fails are pushed to the end (treated as effectively unknown / latest) so the
 * call never rejects.
 */
async function sortByMtimeAscending(uris: readonly vscode.Uri[]): Promise<vscode.Uri[]> {
    const withStats = await Promise.all(uris.map(async (u) => {
        try {
            const s = await vscode.workspace.fs.stat(u);
            return { uri: u, mtime: s.mtime };
        } catch { return { uri: u, mtime: Number.MAX_SAFE_INTEGER }; }
    }));
    withStats.sort((a, b) => a.mtime - b.mtime);
    return withStats.map((x) => x.uri);
}

/** Minimal target interface \u2014 mirrors what LogViewerProvider exposes to load helpers. */
export interface AppendGroupMemberTarget {
    postMessage(msg: unknown): void;
    getSeenCategories(): Set<string>;
}

/**
 * Read a group member's contents and append as an additional source stream.
 *
 * The member is tagged with a filename-derived label so the existing source-tag
 * filter in the webview can toggle it on/off like any sidecar. Binary / empty
 * files produce zero lines and are silently skipped.
 *
 * Posts:
 *   - `setSources` (additive) \u2014 include the new `external:<label>` in the
 *     enabled-sources list so the lines aren't hidden by default.
 *   - `addLines` \u2014 the member's content as pending lines.
 *
 * Does NOT mutate `currentFileUri` on the target (the primary remains the
 * logical owner of the viewer state).
 */
export async function appendGroupMember(
    target: AppendGroupMemberTarget,
    memberUri: vscode.Uri,
    primaryBase: string,
): Promise<void> {
    const memberName = memberUri.fsPath.split(/[\\/]/).pop() ?? "";
    const label = sourceTagForGroupMember(primaryBase, memberName);
    const raw = await vscode.workspace.fs.readFile(memberUri);
    const text = Buffer.from(raw).toString("utf-8");
    const pending = parseExternalSidecarToPending(text, label);
    if (pending.length === 0) { return; }
    const newSource = SOURCE_EXTERNAL_PREFIX + label;
    // Register the new source so the filter UI reveals it. The webview's
    // setSources handler merges with any existing source list, so sending
    // only the new one is safe \u2014 callers don't need to re-enumerate.
    target.postMessage({ type: "setSources", sources: [newSource], enabledSources: [newSource] });
    target.postMessage({ type: "addLines", lines: pending, lineCount: pending.length });
    // Surface any new categories to the viewer's category filter.
    const newCats = new Set<string>();
    for (const line of pending) {
        if (!line.isMarker && !target.getSeenCategories().has(line.category)) {
            newCats.add(line.category);
        }
    }
    if (newCats.size > 0) {
        for (const c of newCats) { target.getSeenCategories().add(c); }
        target.postMessage({ type: "setCategories", categories: [...newCats] });
    }
}
