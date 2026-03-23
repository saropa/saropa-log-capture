/**
 * Buffers user interactions and flushes them to {@link LearningStore}.
 *
 * **Concurrency:** `track()` may run while `flush()` is awaiting `workspaceState.update`.
 * A naïve “if flush in flight, await and return” would drop items appended during that await.
 * This implementation loops until the buffer is empty so every snapshot is persisted.
 *
 * **Recursion:** No recursive `flush` calls—only a `while` loop—so stack depth stays bounded.
 */

import type { InteractionBatch, TrackInteractionMessage, UserInteraction } from "./interaction-types";
import { isTrackableInteractionType } from "./interaction-types";
import type { LearningStore } from "./learning-store";

export interface InteractionTrackerOptions {
    readonly store: LearningStore;
    readonly getSessionId: () => string;
    readonly getMaxLineLength: () => number;
    readonly isEnabled: () => boolean;
}

export class InteractionTracker {
    private buffer: UserInteraction[] = [];
    private readonly maxBuffer = 1000;
    private flushInFlight: Promise<void> | undefined;

    constructor(private readonly opts: InteractionTrackerOptions) {}

    /** Record one interaction (truncates line text; no-op when learning disabled). */
    track(interaction: Omit<UserInteraction, "timestamp">): void {
        if (!this.opts.isEnabled()) {
            return;
        }
        const maxLen = Math.max(80, this.opts.getMaxLineLength());
        let lineText = interaction.lineText;
        if (lineText.length > maxLen) {
            lineText = lineText.slice(0, maxLen);
        }
        this.buffer.push({
            ...interaction,
            lineText,
            timestamp: Date.now(),
        });
        if (this.buffer.length >= this.maxBuffer) {
            void this.flush();
        }
    }

    /** Flush buffer to storage for pattern analysis (drains concurrent `track` writes). */
    async flush(): Promise<void> {
        for (;;) {
            if (this.buffer.length === 0) {
                return;
            }
            if (this.flushInFlight) {
                await this.flushInFlight;
                continue;
            }
            const snapshot = [...this.buffer];
            this.buffer = [];
            const batch: InteractionBatch = {
                interactions: snapshot,
                sessionId: this.opts.getSessionId(),
                batchedAt: Date.now(),
            };
            this.flushInFlight = this.opts.store.saveBatch(batch).finally(() => {
                this.flushInFlight = undefined;
            });
            await this.flushInFlight;
        }
    }

    /** Validate and record a webview `trackInteraction` message. */
    handleViewerMessage(msg: TrackInteractionMessage): void {
        if (msg.type !== "trackInteraction") {
            return;
        }
        const { interactionType, lineText, lineLevel, context } = msg;
        if (!isTrackableInteractionType(interactionType) || !lineText.trim()) {
            return;
        }
        this.track({ type: interactionType, lineText, lineLevel: lineLevel ?? "", context });
    }
}
