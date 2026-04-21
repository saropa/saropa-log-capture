/**
 * Helpers for the discriminated `CollectionSource` union.
 *
 * `CollectionSource` is either a file/session source (keyed by `relativePath`) or a
 * session-group source (keyed by `groupId`). Callers need a common way to:
 *   - Build a stable identity key for dedupe/remove operations
 *   - Convert an `AddSourceInput` into the persisted `CollectionSource` shape
 *   - Compare two sources for equality without narrowing each site
 *
 * Keeping the logic here (instead of inline in `collection-store.ts`) keeps that
 * file under the 300-line limit and lets the webview/command layers reuse the
 * key format when posting/receiving "remove" intents.
 */

import type {
    CollectionSource,
    AddSourceInput,
    CollectionFileSource,
    CollectionGroupSource,
} from './collection-types';

/** Prefix used on the key for group sources so they can't collide with file paths. */
const GROUP_KEY_PREFIX = 'group:';

/**
 * Return a stable string key identifying a source within its collection:
 *   - file/session sources \u2192 their workspace-relative path
 *   - group sources       \u2192 `group:<groupId>`
 *
 * Used for dedupe in `addSource`, lookup in `removeSource`, and comparisons in
 * `mergeCollections`. The prefix on group keys prevents a pathological
 * relativePath of the form `group:something` from colliding.
 */
export function collectionSourceKey(source: CollectionSource): string {
    if (source.type === 'group') { return GROUP_KEY_PREFIX + source.groupId; }
    return source.relativePath;
}

/** Key-form for an `AddSourceInput` \u2014 mirrors `collectionSourceKey()` for the input shape. */
export function addSourceInputKey(input: AddSourceInput): string {
    if (input.type === 'group') { return GROUP_KEY_PREFIX + input.groupId; }
    return input.relativePath;
}

/** Return true when `input` duplicates one of `existing` by key. Used to skip re-adding sources. */
export function isDuplicateSource(
    existing: readonly CollectionSource[],
    input: AddSourceInput,
): boolean {
    const key = addSourceInputKey(input);
    return existing.some((s) => collectionSourceKey(s) === key);
}

/** Convert an `AddSourceInput` into the persisted `CollectionSource` shape, stamping `pinnedAt` now. */
export function toCollectionSource(input: AddSourceInput): CollectionSource {
    if (input.type === 'group') {
        const out: CollectionGroupSource = {
            type: 'group',
            groupId: input.groupId,
            label: input.label,
            pinnedAt: Date.now(),
        };
        return out;
    }
    const out: CollectionFileSource = {
        type: input.type,
        relativePath: input.relativePath,
        label: input.label,
        pinnedAt: Date.now(),
    };
    return out;
}

/** Convert an existing `CollectionSource` back into the `AddSourceInput` shape (for merges). */
export function toAddSourceInput(source: CollectionSource): AddSourceInput {
    if (source.type === 'group') {
        return { type: 'group', groupId: source.groupId, label: source.label };
    }
    return { type: source.type, relativePath: source.relativePath, label: source.label };
}

/** Workspace-relative path for display \u2014 returns the synthetic group key when the source is a group. */
export function collectionSourceDisplayPath(source: CollectionSource): string {
    return collectionSourceKey(source);
}
