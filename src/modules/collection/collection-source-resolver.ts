/**
 * Resolve a collection's mixed source list down to a list of file-type sources.
 *
 * `CollectionSource` is a union of `CollectionFileSource` (session/file, keyed by
 * workspace-relative path) and `CollectionGroupSource` (session group, keyed by
 * `groupId`). Search, export, and bundle pipelines operate on files, not groups,
 * so they call this resolver first to expand every group source into the files
 * currently sharing its `groupId`.
 *
 * Expansion is done AT QUERY TIME (not pin time) so that if the user ungroups or
 * manually regroups files later, the collection reflects the CURRENT group state
 * instead of a stale snapshot. If the group has since been completely dismantled
 * (zero members), the group source contributes zero files; the pin remains in
 * the collection for the user to review.
 *
 * Dedup: the same `relativePath` never appears twice in the output, even when a
 * file is simultaneously pinned directly AND via a group expansion.
 */

import * as vscode from 'vscode';
import type { SessionMetadataStore, SessionMeta } from '../session/session-metadata';
import type { CollectionSource, CollectionFileSource } from './collection-types';

/** Expand every group source in `sources` to its current members; pass file/session sources through. */
export async function resolveCollectionSources(
    sources: readonly CollectionSource[],
    logDir: vscode.Uri,
    store: SessionMetadataStore,
): Promise<CollectionFileSource[]> {
    if (sources.length === 0) { return []; }
    const out: CollectionFileSource[] = [];
    const seen = new Set<string>();
    // Lazy-load the metadata map only if a group source actually exists.
    let metaMap: ReadonlyMap<string, SessionMeta> | undefined;
    for (const source of sources) {
        if (source.type !== 'group') {
            pushUnique(out, seen, source);
            continue;
        }
        if (!metaMap) { metaMap = await store.loadAllMetadata(logDir); }
        for (const memberSource of expandGroup(source, metaMap)) {
            pushUnique(out, seen, memberSource);
        }
    }
    return out;
}

/** Push `source` into `out` unless we've already emitted one with the same relativePath. */
function pushUnique(
    out: CollectionFileSource[],
    seen: Set<string>,
    source: CollectionFileSource,
): void {
    if (seen.has(source.relativePath)) { return; }
    seen.add(source.relativePath);
    out.push(source);
}

/** Map every member of a session group into a synthetic `CollectionFileSource` of type 'session'. */
function expandGroup(
    group: { readonly groupId: string; readonly label: string; readonly pinnedAt: number },
    metaMap: ReadonlyMap<string, SessionMeta>,
): CollectionFileSource[] {
    const members: CollectionFileSource[] = [];
    for (const [relPath, meta] of metaMap) {
        if (meta.groupId !== group.groupId) { continue; }
        members.push({
            type: 'session',
            relativePath: relPath,
            // Label reads like "Group Label / filename.log" so the search/export UI shows both
            // which group the hit came from AND the specific file it lives in.
            label: `${group.label} / ${relPath.split('/').pop() ?? relPath}`,
            pinnedAt: group.pinnedAt,
        });
    }
    return members;
}
