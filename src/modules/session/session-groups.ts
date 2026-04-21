/**
 * Session groups — group log files captured in the same time window into a
 * single logical Session.
 *
 * Two trigger modes (see bugs/auto-group-related-sessions.md for the full spec):
 *
 *   1. DAP-anchored: a debug session starts, mints a groupId, claims pre-existing
 *      ungrouped files whose mtime is within `lookbackSeconds` of the start, and
 *      stamps every new log file created before the debug session ends.
 *
 *   2. Standalone: when \u22652 distinct integration providers fire within the
 *      lookback window on ungrouped files, mint a groupId and claim them. The
 *      group stays open until `idleSeconds` of silence elapses.
 *
 * A file with an existing `groupId` is never re-claimed. Files are never
 * silently moved between groups.
 *
 * This module provides the pure-function surface: primary-member derivation,
 * descriptor construction from the metadata map, and id generation. The
 * anchor/claim state machine lives in `session-group-tracker.ts` (Phase 2).
 */

import * as crypto from 'node:crypto';
import type { SessionMeta } from './session-metadata';

/**
 * Minimal shape needed to pick the primary member.
 *
 * Tests and callers can pass any object with these two fields — the pure
 * `getPrimaryMember()` rule does not need the full `SessionMeta` + mtime
 * coupling.
 */
export interface PrimaryMemberInput {
    /** Debug adapter type (e.g. "dart", "node"). Set only on DAP session files. */
    readonly debugAdapterType?: string;
    /** File modification time (epoch ms). Used as tiebreaker and standalone-mode anchor. */
    readonly mtime: number;
}

/**
 * A session group descriptor — derived from the metadata map plus file stats.
 * Never persisted. Rebuilt on each tree refresh.
 */
export interface SessionGroupDescriptor<T extends PrimaryMemberInput = PrimaryMemberInput> {
    /** Shared group id (UUID). */
    readonly groupId: string;
    /** All members in ascending mtime order. */
    readonly members: readonly T[];
    /** The primary member per `getPrimaryMember()` rule. Always one of `members`. */
    readonly primary: T;
    /** Earliest member mtime. */
    readonly earliestMtime: number;
    /** Latest member mtime. */
    readonly latestMtime: number;
}

/**
 * Pick the primary member of a group.
 *
 * Rule (see plan §"Primary member"):
 *   1. If any member has `debugAdapterType` set (i.e. it came from a DAP debug
 *      session), that member is primary. Earliest mtime wins among multiple
 *      DAP members (edge case: nested/back-to-back debug sessions).
 *   2. Otherwise, the earliest-mtime member is primary.
 *
 * Rationale for pure derivation: the rule is a function of existing fields.
 * A persisted `isPrimary` flag would drift if a user added a DAP file to the
 * group via manual grouping, or ungrouped and re-grouped in a different order.
 *
 * @param members Non-empty array of group members.
 * @returns The primary member (always a reference to one of the inputs).
 * @throws {Error} If `members` is empty — a group with no members is invalid.
 */
export function getPrimaryMember<T extends PrimaryMemberInput>(members: readonly T[]): T {
    if (members.length === 0) {
        throw new Error('getPrimaryMember: cannot pick primary of an empty group');
    }
    // Find DAP members (those with a debugAdapterType set).
    const dapMembers = members.filter(m => typeof m.debugAdapterType === 'string' && m.debugAdapterType.length > 0);
    if (dapMembers.length > 0) {
        // Earliest-mtime DAP member wins (handles edge case of multiple DAP files in one group).
        return dapMembers.reduce((earliest, m) => (m.mtime < earliest.mtime ? m : earliest));
    }
    // Standalone group — earliest-mtime member is primary.
    return members.reduce((earliest, m) => (m.mtime < earliest.mtime ? m : earliest));
}

/**
 * Generate a new group id.
 *
 * Uses Node's built-in `crypto.randomUUID()` (stable in Node 14.17+, which VS
 * Code ships with). Keeps the module dependency-free.
 */
export function generateGroupId(): string {
    return crypto.randomUUID();
}

/**
 * Shape required from per-file stats (relative path \u2192 stats) when building
 * descriptors. Callers typically derive this from `vscode.workspace.fs.stat()`.
 */
export interface GroupMemberStats {
    readonly mtime: number;
}

/**
 * A member resolved from the metadata map + stats, carrying everything needed
 * for descriptor queries and rendering.
 */
export interface ResolvedGroupMember {
    /** Workspace-relative path (the key in MetaMap). */
    readonly relativePath: string;
    /** Debug adapter type if present on the SessionMeta. */
    readonly debugAdapterType?: string;
    /** File mtime (epoch ms). */
    readonly mtime: number;
}

/**
 * Build descriptors for every group that exists in the given metadata map.
 *
 * Inputs:
 *   - `metaMap`    workspace-relative path \u2192 SessionMeta (with optional groupId).
 *   - `stats`      workspace-relative path \u2192 GroupMemberStats (for mtime).
 *
 * Files whose stats are missing are silently dropped. A file with a `groupId`
 * but missing stats typically means the file was deleted behind the scenes;
 * the orphan groupId entry is left in the meta map and will be cleaned up
 * either by a future retention sweep or on next ungroup.
 *
 * Returns a Map keyed by groupId for O(1) lookup during tree rendering.
 */
export function buildGroupIndex(
    metaMap: ReadonlyMap<string, SessionMeta>,
    stats: ReadonlyMap<string, GroupMemberStats>,
): Map<string, SessionGroupDescriptor<ResolvedGroupMember>> {
    // Bucket members by groupId.
    const buckets = new Map<string, ResolvedGroupMember[]>();
    for (const [relPath, meta] of metaMap) {
        if (!meta.groupId) { continue; }
        const stat = stats.get(relPath);
        if (!stat) { continue; }
        const member: ResolvedGroupMember = {
            relativePath: relPath,
            debugAdapterType: meta.debugAdapterType,
            mtime: stat.mtime,
        };
        const bucket = buckets.get(meta.groupId);
        if (bucket) { bucket.push(member); } else { buckets.set(meta.groupId, [member]); }
    }

    const descriptors = new Map<string, SessionGroupDescriptor<ResolvedGroupMember>>();
    for (const [groupId, rawMembers] of buckets) {
        // A group with a single remaining member is effectively ungrouped — skip the descriptor
        // so callers render it as a standalone row. The stale groupId is harmless and will be
        // cleaned up on next ungroup/retention pass.
        if (rawMembers.length < 2) { continue; }
        // Sort members ascending by mtime for deterministic rendering.
        const members = [...rawMembers].sort((a, b) => a.mtime - b.mtime);
        const primary = getPrimaryMember(members);
        descriptors.set(groupId, {
            groupId,
            members,
            primary,
            earliestMtime: members[0].mtime,
            latestMtime: members[members.length - 1].mtime,
        });
    }
    return descriptors;
}

/**
 * Count the secondary members in a group (i.e. total minus the primary).
 * Used for the `+N` suffix on the collapsed primary row.
 */
export function secondaryCount(descriptor: SessionGroupDescriptor): number {
    return descriptor.members.length - 1;
}
