"use strict";
/**
 * Noise-learning interaction model: webview and extension record the same shapes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKABLE_INTERACTION_TYPES = void 0;
exports.isTrackableInteractionType = isTrackableInteractionType;
/** Values accepted from webview `trackInteraction` messages. */
exports.TRACKABLE_INTERACTION_TYPES = [
    "dismiss",
    "filter-out",
    "add-exclusion",
    "skip-scroll",
    "explicit-keep",
];
function isTrackableInteractionType(v) {
    return exports.TRACKABLE_INTERACTION_TYPES.includes(v);
}
//# sourceMappingURL=interaction-types.js.map