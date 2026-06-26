/**
 * Resolve an investigation's session keys (workspace-relative paths) into concrete session
 * metadata for display and opening. Investigation membership is stored as keys only (so it survives
 * a rename/move of the metadata cache); this module joins those keys back to the live tree items.
 */

import { relativeKey } from './session-metadata-io';
import {
    isSessionGroup,
    isSplitGroup,
    type TreeItem,
    type SessionMetadata,
} from '../../ui/session/session-history-grouping';
import { buildVscodeFileUri } from '../source/link-helpers';
import type { Investigation } from './investigation-model';
import type { InvestigationMember } from './investigation-overview';

/** Flatten group / split-group tree items down to their leaf session metadata. */
export function flattenLeafSessions(items: readonly TreeItem[]): SessionMetadata[] {
    const out: SessionMetadata[] = [];
    for (const item of items) {
        if (isSessionGroup(item)) {
            out.push(...flattenLeafSessions(item.members));
        } else if (isSplitGroup(item)) {
            out.push(...item.parts);
        } else {
            out.push(item);
        }
    }
    return out;
}

/** Build a `relativeKey(uri) -> SessionMetadata` map for resolving investigation keys. */
export function buildSessionKeyMap(
    leaves: readonly SessionMetadata[],
): Map<string, SessionMetadata> {
    const map = new Map<string, SessionMetadata>();
    for (const leaf of leaves) {
        map.set(relativeKey(leaf.uri), leaf);
    }
    return map;
}

/** A resolved member plus its source metadata (or undefined when the file is gone). */
export interface ResolvedInvestigationMember {
    readonly member: InvestigationMember;
    readonly meta?: SessionMetadata;
}

/**
 * Resolve every key in an investigation. A key whose file is no longer present still produces a
 * member (labelled by the raw key) so the overview shows the gap rather than silently dropping it —
 * the log may have been deleted but the investigation record of it is still meaningful.
 */
export function resolveInvestigationMembers(
    inv: Investigation,
    keyMap: ReadonlyMap<string, SessionMetadata>,
): ResolvedInvestigationMember[] {
    return inv.sessionKeys.map((key) => {
        const meta = keyMap.get(key);
        if (!meta) {
            return { member: { key, displayName: key } };
        }
        const member: InvestigationMember = {
            key,
            displayName: meta.displayName ?? meta.filename,
            link: buildVscodeFileUri(meta.uri.fsPath),
            errorCount: meta.errorCount,
            warningCount: meta.warningCount,
            note: meta.note,
        };
        return { member, meta };
    });
}
