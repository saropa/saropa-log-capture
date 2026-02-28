/**
 * Automatic flood protection — detects and suppresses rapid repeated messages
 * without requiring user configuration.
 */

/** Threshold: suppress after this many identical messages in the time window. */
const repeatThreshold = 100;

/** Time window in ms for tracking repeats. */
const windowMs = 1000;

/** How often to let one through when suppressed (for visibility). */
const sampleInterval = 1000;

export interface FloodResult {
    /** Whether the message should be processed. */
    readonly allow: boolean;
    /** If suppressed, how many were dropped since last allowed. */
    readonly suppressedCount?: number;
}

/**
 * Detects rapid repeated messages and suppresses them to prevent lockups.
 * Zero config required — kicks in automatically when flood detected.
 */
export class FloodGuard {
    private lastMessage = '';
    private repeatCount = 0;
    private windowStart = 0;
    private suppressing = false;
    private suppressedSinceLastSample = 0;
    private lastSampleTime = 0;

    /**
     * Check if a message should be processed or suppressed.
     * Call this for every incoming message.
     */
    check(text: string): FloodResult {
        const now = Date.now();

        // Different message — reset tracking
        if (text !== this.lastMessage) {
            const result = this.exitSuppression();
            this.lastMessage = text;
            this.repeatCount = 1;
            this.windowStart = now;
            this.suppressing = false;
            return result;
        }

        // Same message — increment counter
        this.repeatCount++;

        // Reset window if expired
        if (now - this.windowStart > windowMs) {
            this.repeatCount = 1;
            this.windowStart = now;
            if (this.suppressing) {
                return this.exitSuppression();
            }
        }

        // Check if we should start suppressing
        if (!this.suppressing && this.repeatCount > repeatThreshold) {
            this.suppressing = true;
            this.suppressedSinceLastSample = 0;
            this.lastSampleTime = now;
        }

        // If suppressing, only let one through periodically
        if (this.suppressing) {
            this.suppressedSinceLastSample++;
            if (now - this.lastSampleTime >= sampleInterval) {
                const count = this.suppressedSinceLastSample;
                this.suppressedSinceLastSample = 0;
                this.lastSampleTime = now;
                return { allow: true, suppressedCount: count };
            }
            return { allow: false };
        }

        return { allow: true };
    }

    /** Called when exiting suppression mode. */
    private exitSuppression(): FloodResult {
        if (this.suppressing && this.suppressedSinceLastSample > 0) {
            const count = this.suppressedSinceLastSample;
            this.suppressedSinceLastSample = 0;
            this.suppressing = false;
            return { allow: true, suppressedCount: count };
        }
        this.suppressing = false;
        return { allow: true };
    }

    /** Reset all state (e.g., on session start). */
    reset(): void {
        this.lastMessage = '';
        this.repeatCount = 0;
        this.windowStart = 0;
        this.suppressing = false;
        this.suppressedSinceLastSample = 0;
        this.lastSampleTime = 0;
    }
}
