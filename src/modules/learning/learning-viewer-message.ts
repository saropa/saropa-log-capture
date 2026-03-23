/**
 * Validates inbound webview `trackInteraction` messages before they reach `InteractionTracker`.
 *
 * Keeps parsing out of `viewer-message-handler-actions.ts` (line-count / switch size) and rejects
 * malformed payloads early (wrong `interactionType`, empty `lineText`).
 */

import type { TrackInteractionMessage } from "./interaction-types";
import { isTrackableInteractionType } from "./interaction-types";
import { getInteractionTracker } from "./learning-runtime";

function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
    const v = m[key];
    return typeof v === "string" ? v : fallback;
}

export function handleTrackInteractionRecord(msg: Record<string, unknown>): void {
    if (msg.type !== "trackInteraction") {
        return;
    }
    const interactionTypeRaw = msg.interactionType;
    if (typeof interactionTypeRaw !== "string" || !isTrackableInteractionType(interactionTypeRaw)) {
        return;
    }
    const lineText = msgStr(msg, "lineText").trim();
    if (!lineText) {
        return;
    }
    const payload: TrackInteractionMessage = {
        type: "trackInteraction",
        interactionType: interactionTypeRaw,
        lineText,
        lineLevel: msgStr(msg, "lineLevel"),
    };
    getInteractionTracker()?.handleViewerMessage(payload);
}
