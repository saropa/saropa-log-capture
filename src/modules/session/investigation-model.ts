/**
 * Investigation Groups — the curated, human-named layer over automatic session grouping
 * (cross-session-analysis idea #2).
 *
 * Automatic grouping (`session-groups.ts` / `session-group-tracker.ts`) bundles log files that
 * were captured close together by time/DAP boundary; it has no title and no notes of its own. An
 * Investigation is the opposite: a deliberately-named bundle ("Bug #42: Payment timeout") spanning
 * sessions the developer *chose* to relate, with free-text notes recording the root cause. It does
 * not move or re-claim files — a session can sit in an auto group AND one or more investigations.
 *
 * This module is the PURE surface: types plus immutable list transforms. It has no vscode / fs
 * dependency so it is unit-testable under `node --test`. The Memento-backed persistence and the
 * id/timestamp minting live in `investigation-store.ts`.
 */

/** A curated, named bundle of related sessions. */
export interface Investigation {
    /** Stable unique id (UUID), assigned once at creation. */
    readonly id: string;
    /** Human-entered title, e.g. "Bug #42: Payment timeout". */
    readonly title: string;
    /** Free-text notes — root cause, fix attempts, conclusions. Empty string when unset. */
    readonly notes: string;
    /**
     * Member sessions as workspace-relative keys (the same `relativeKey(uri)` used as the
     * SessionMeta map key), so a key resolves back to a log file URI. Order is insertion order.
     */
    readonly sessionKeys: readonly string[];
    /** Epoch ms the investigation was created — newest-first sort in pickers. */
    readonly createdAt: number;
}

/** Apply an immutable transform to the one investigation whose id matches; others pass through. */
function mapById(
    list: readonly Investigation[],
    id: string,
    transform: (inv: Investigation) => Investigation,
): Investigation[] {
    return list.map((inv) => (inv.id === id ? transform(inv) : inv));
}

/** Add a new investigation, or replace an existing one with the same id (by-id upsert). */
export function upsertInvestigation(
    list: readonly Investigation[],
    inv: Investigation,
): Investigation[] {
    const exists = list.some((i) => i.id === inv.id);
    return exists ? mapById(list, inv.id, () => inv) : [...list, inv];
}

/** Drop the investigation with the given id (no-op when absent). */
export function removeInvestigationById(
    list: readonly Investigation[],
    id: string,
): Investigation[] {
    return list.filter((inv) => inv.id !== id);
}

/** Set a new title on one investigation. */
export function renameInvestigation(
    list: readonly Investigation[],
    id: string,
    title: string,
): Investigation[] {
    return mapById(list, id, (inv) => ({ ...inv, title }));
}

/** Replace the notes on one investigation. */
export function setInvestigationNotes(
    list: readonly Investigation[],
    id: string,
    notes: string,
): Investigation[] {
    return mapById(list, id, (inv) => ({ ...inv, notes }));
}

/** Add a session key to one investigation, de-duplicating so a session is never listed twice. */
export function addSessionKey(
    list: readonly Investigation[],
    id: string,
    key: string,
): Investigation[] {
    return mapById(list, id, (inv) =>
        inv.sessionKeys.includes(key)
            ? inv
            : { ...inv, sessionKeys: [...inv.sessionKeys, key] });
}

/** Remove a session key from one investigation (no-op when absent). */
export function removeSessionKey(
    list: readonly Investigation[],
    id: string,
    key: string,
): Investigation[] {
    return mapById(list, id, (inv) => ({
        ...inv,
        sessionKeys: inv.sessionKeys.filter((k) => k !== key),
    }));
}

/** Find one investigation by id. */
export function findById(
    list: readonly Investigation[],
    id: string,
): Investigation | undefined {
    return list.find((inv) => inv.id === id);
}

/** Every investigation that contains the given session key (a session may be in several). */
export function investigationsContaining(
    list: readonly Investigation[],
    key: string,
): Investigation[] {
    return list.filter((inv) => inv.sessionKeys.includes(key));
}
