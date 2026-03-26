"use strict";
/**
 * Automatic flood protection — detects and suppresses rapid repeated messages
 * without requiring user configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloodGuard = void 0;
/** Threshold: suppress after this many identical messages in the time window. */
const repeatThreshold = 100;
/** Time window in ms for tracking repeats. */
const windowMs = 1000;
/** How often to let one through when suppressed (for visibility). */
const sampleInterval = 1000;
/**
 * Detects rapid repeated messages and suppresses them to prevent lockups.
 * Zero config required — kicks in automatically when flood detected.
 */
class FloodGuard {
    lastMessage = '';
    repeatCount = 0;
    windowStart = 0;
    suppressing = false;
    suppressedSinceLastSample = 0;
    lastSampleTime = 0;
    /**
     * Check if a message should be processed or suppressed.
     * Call this for every incoming message.
     */
    check(text) {
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
    exitSuppression() {
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
    reset() {
        this.lastMessage = '';
        this.repeatCount = 0;
        this.windowStart = 0;
        this.suppressing = false;
        this.suppressedSinceLastSample = 0;
        this.lastSampleTime = 0;
    }
}
exports.FloodGuard = FloodGuard;
//# sourceMappingURL=flood-guard.js.map