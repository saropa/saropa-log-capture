"use strict";
/**
 * Validates inbound webview `trackInteraction` messages before they reach `InteractionTracker`.
 *
 * Keeps parsing out of `viewer-message-handler-actions.ts` (line-count / switch size) and rejects
 * malformed payloads early (wrong `interactionType`, empty `lineText`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTrackInteractionRecord = handleTrackInteractionRecord;
const interaction_types_1 = require("./interaction-types");
const learning_runtime_1 = require("./learning-runtime");
function msgStr(m, key, fallback = "") {
    const v = m[key];
    return typeof v === "string" ? v : fallback;
}
function handleTrackInteractionRecord(msg) {
    if (msg.type !== "trackInteraction") {
        return;
    }
    const interactionTypeRaw = msg.interactionType;
    if (typeof interactionTypeRaw !== "string" || !(0, interaction_types_1.isTrackableInteractionType)(interactionTypeRaw)) {
        return;
    }
    const lineText = msgStr(msg, "lineText").trim();
    if (!lineText) {
        return;
    }
    const payload = {
        type: "trackInteraction",
        interactionType: interactionTypeRaw,
        lineText,
        lineLevel: msgStr(msg, "lineLevel"),
    };
    (0, learning_runtime_1.getInteractionTracker)()?.handleViewerMessage(payload);
}
//# sourceMappingURL=learning-viewer-message.js.map