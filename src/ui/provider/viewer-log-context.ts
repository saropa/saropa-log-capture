/**
 * Computes the "log context" payload that drives the unified log banner and the
 * toolbar staleness indicator (plan 109 — bugs/109_plan-unified-log-banner.md).
 *
 * This replaces the old "Log N of M" session navigator. Instead of position, the
 * toolbar conveys *how out of date* the open log is, and the banner auto-surfaces
 * when a newer important log exists.
 *
 * "Important" = a log whose role classifies as `controller` (the workspace's own
 * main project session). Peripherals — auxiliary tool logs (drift advisor, lint
 * reports, bundles) that nest under a controller — never count toward staleness.
 * Role logic lives in modules/session/session-kind-classifier.ts.
 */

import { classifySessionRole } from "../../modules/session/session-kind-classifier";
import {
    isSessionGroup,
    isSplitGroup,
    type SessionMetadata,
    type TreeItem,
} from "../session/session-history-grouping";

/** Payload posted to the webview as the `logContextInfo` message. */
export interface LogContextInfo {
    /** URI string of the log currently open in the viewer ('' when none). */
    readonly currentUri: string;
    /** Session start (epoch ms), derived as `mtime - durationMs`. 0 when unknown. */
    readonly startedMs: number;
    /** Session duration (ms). 0 when unknown — the webview then omits the "ran" clause. */
    readonly durationMs: number;
    /** True when the open log is NOT the latest controller log (drives the toolbar warning). */
    readonly stale: boolean;
    /** Count of controller logs newer than the open one (the "N newer" the toolbar shows). */
    readonly newerCount: number;
    /** True when the banner should auto-surface: stale AND the newer log post-dates the dismiss
     *  cursor. Dismiss advances the cursor, so a dismissed alert never re-nags until a newer
     *  controller log than the dismissed one arrives. */
    readonly autoShow: boolean;
    /** Latest controller log's URI ('' when none) — the auto-banner's Open target. */
    readonly latestUri: string;
    /** Latest controller log's display name / filename ('' when none). */
    readonly latestName: string;
    /** Latest controller log's mtime (epoch ms; 0 when none) — the webview formats it as "ago". */
    readonly latestMtime: number;
}

/** Inputs for computeLogContextInfo. Mirrors makePayloadOptions' classifier inputs. */
export interface LogContextParams {
    readonly items: readonly TreeItem[];
    readonly currentUri: string | undefined;
    readonly controllerNames: readonly string[];
    readonly workspaceFolderName: string | undefined;
    /** Logs-panel dismiss cursor (ms). A controller log newer than this triggers autoShow. */
    readonly dismissedAt: number;
}

/** Flatten the tree into plain leaf sessions (split parts + group members + singletons). */
function flattenLeafSessions(items: readonly TreeItem[]): SessionMetadata[] {
    const leaves: SessionMetadata[] = [];
    for (const item of items) {
        if (isSessionGroup(item)) {
            leaves.push(...flattenLeafSessions(item.members));
        } else if (isSplitGroup(item)) {
            leaves.push(...item.parts);
        } else {
            leaves.push(item);
        }
    }
    return leaves;
}

/** True when a leaf classifies as a controller (the workspace's own main project session). */
function isController(
    leaf: SessionMetadata,
    controllerNames: readonly string[],
    folderName: string | undefined,
): boolean {
    return classifySessionRole(
        { role: leaf.role, kind: leaf.kind, debugAdapterType: leaf.debugAdapterType, project: leaf.project, displayName: leaf.displayName },
        controllerNames,
        folderName,
    ) === "controller";
}

/** Pick the controller leaf with the highest mtime (null when there are no controllers). */
function latestControllerLeaf(
    leaves: readonly SessionMetadata[],
    controllerNames: readonly string[],
    folderName: string | undefined,
): SessionMetadata | null {
    let latest: SessionMetadata | null = null;
    for (const leaf of leaves) {
        if (!isController(leaf, controllerNames, folderName)) { continue; }
        if (!latest || leaf.mtime > latest.mtime) { latest = leaf; }
    }
    return latest;
}

/** Build the LogContextInfo payload from the session tree and the open log. */
export function computeLogContextInfo(params: LogContextParams): LogContextInfo {
    const { items, currentUri, controllerNames, workspaceFolderName, dismissedAt } = params;
    const leaves = flattenLeafSessions(items);
    const current = currentUri ? leaves.find((l) => l.uri.toString() === currentUri) : undefined;
    const currentMtime = current?.mtime ?? 0;
    const durationMs = current?.durationMs ?? 0;
    const startedMs = current && durationMs > 0 ? current.mtime - durationMs : 0;

    const latest = latestControllerLeaf(leaves, controllerNames, workspaceFolderName);
    const latestUri = latest?.uri.toString() ?? "";
    // newerCount counts controller logs strictly newer than the open one — the "you are N behind"
    // figure. Excludes the open log itself so viewing the newest reads as 0 newer.
    const newerCount = currentUri
        ? leaves.filter(
            (l) => l.uri.toString() !== currentUri
                && l.mtime > currentMtime
                && isController(l, controllerNames, workspaceFolderName),
        ).length
        : 0;

    // stale = at least one controller log is NEWER than the open one (you are behind the main
    // project). Basing it on newerCount (not latestUri !== currentUri) avoids a false "stale" when
    // the open log is a peripheral that post-dates every controller — then there is nothing newer to
    // catch up to. stale drives the always-visible toolbar warning; autoShow additionally requires
    // the newer log to post-date the dismiss cursor, so a dismissed alert stays quiet until a
    // controller log newer than the dismissed one appears.
    const stale = newerCount > 0;
    const autoShow = stale && (latest?.mtime ?? 0) > dismissedAt;

    return {
        currentUri: currentUri ?? "",
        startedMs,
        durationMs,
        stale,
        newerCount,
        autoShow,
        latestUri,
        latestName: latest?.displayName ?? latest?.filename ?? "",
        latestMtime: latest?.mtime ?? 0,
    };
}

/**
 * Decide whether the viewer should auto-switch to the newest controller log, given the just-computed
 * log context and the user's `autoSwitchToLatest` setting. Pure so the decision is unit-testable
 * without the Extension Host (mirrors the extracted `shouldAutoLoad` predicate).
 *
 * Returns true only when the setting is on, a newer controller log exists (`stale`), that log has a
 * URI, it differs from the open one, and it ARRIVED after `arrivedSinceMs`. `stale` is the
 * load-bearing anti-loop guard: it is mtime-based, so once the viewer loads `latestUri` that log
 * becomes the newest controller, `newerCount` drops to 0, `stale` clears, and this returns false on
 * the next tree refresh — no reload loop. When nothing is open (`currentUri` empty) `newerCount` is
 * 0 → `stale` false, so this never fires against an empty viewer and never fights the first-visit
 * autoLoadInitialLog path.
 *
 * `arrivedSinceMs` (the window's activation time) is what makes "always switch to latest" mean what
 * its setting description says: "switches to the newest log the moment it ARRIVES". Without it, any
 * `reports/` watcher event (session-history-provider.ts wires onDidCreate/onDidChange/onDidDelete →
 * refresh → this predicate) would switch the viewer off a log the user deliberately opened, merely
 * because a PRE-EXISTING log on disk happens to be newer. That silently defeated the startup
 * last-viewed restore (plan 111): the correct log loaded, then the first unrelated file event
 * yanked the viewer to the newest one.
 */
export function shouldAutoSwitchToLatest(
    info: LogContextInfo,
    autoSwitchEnabled: boolean,
    arrivedSinceMs: number,
): boolean {
    if (!autoSwitchEnabled || !info.stale) { return false; }
    if (info.latestUri === "" || info.latestUri === info.currentUri) { return false; }
    return info.latestMtime > arrivedSinceMs;
}
