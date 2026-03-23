/**
 * Noise-learning interaction model: webview and extension record the same shapes.
 */

export type InteractionType =
    | "dismiss"
    | "filter-out"
    | "add-exclusion"
    | "skip-scroll"
    | "explicit-keep";

/** Values accepted from webview `trackInteraction` messages. */
export const TRACKABLE_INTERACTION_TYPES: readonly InteractionType[] = [
    "dismiss",
    "filter-out",
    "add-exclusion",
    "skip-scroll",
    "explicit-keep",
] as const;

export function isTrackableInteractionType(v: string): v is InteractionType {
    return (TRACKABLE_INTERACTION_TYPES as readonly string[]).includes(v);
}

export interface UserInteraction {
    timestamp: number;
    type: InteractionType;
    lineText: string;
    lineLevel: string;
    context?: {
        sessionId: string;
        projectName: string;
        debugAdapter: string;
    };
}

/** Webview postMessage ↔ extension handler contract. */
export type TrackInteractionMessage = {
    type: "trackInteraction";
    interactionType: InteractionType;
    lineText: string;
    lineLevel: string;
    context?: UserInteraction["context"];
};

export interface InteractionBatch {
    interactions: UserInteraction[];
    sessionId: string;
    batchedAt: number;
}
