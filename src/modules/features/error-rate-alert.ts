/**
 * Error rate monitoring and alerting.
 * Detects when error frequency exceeds thresholds and alerts the user.
 */

import * as vscode from 'vscode';

/** Configuration for error rate alerting. */
export interface ErrorRateConfig {
    readonly enabled: boolean;
    readonly windowMs: number;
    readonly threshold: number;
    readonly cooldownMs: number;
}

/** Default configuration values. */
const DEFAULT_CONFIG: ErrorRateConfig = {
    enabled: true,
    windowMs: 10000, // 10 seconds
    threshold: 10, // 10 errors per window
    cooldownMs: 30000, // 30 seconds between alerts
};

/** Entry in the sliding window. */
interface RateEntry {
    readonly timestamp: number;
    readonly category: string;
}

/**
 * Monitors error rate using a sliding time window.
 * Alerts the user when the rate exceeds the configured threshold.
 */
export class ErrorRateAlert {
    private readonly entries: RateEntry[] = [];
    private lastAlertTime = 0;
    private readonly config: ErrorRateConfig;
    private alertCallback?: (rate: number, window: number) => void;

    constructor(config: Partial<ErrorRateConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Set a callback for when an alert is triggered. */
    setAlertCallback(callback: (rate: number, windowMs: number) => void): void {
        this.alertCallback = callback;
    }

    /**
     * Record an error occurrence.
     * @returns true if an alert was triggered
     */
    recordError(category: string = 'error'): boolean {
        if (!this.config.enabled) {
            return false;
        }

        const now = Date.now();
        this.entries.push({ timestamp: now, category });

        // Clean old entries outside the window
        this.pruneOldEntries(now);

        // Check if we should alert
        if (this.shouldAlert(now)) {
            this.triggerAlert(now);
            return true;
        }

        return false;
    }

    /** Get the current error count within the window. */
    getCurrentCount(): number {
        this.pruneOldEntries(Date.now());
        return this.entries.length;
    }

    /** Get the current error rate (errors per minute). */
    getCurrentRate(): number {
        const count = this.getCurrentCount();
        const windowMinutes = this.config.windowMs / 60000;
        return count / windowMinutes;
    }

    /** Check if rate exceeds threshold and cooldown has passed. */
    private shouldAlert(now: number): boolean {
        if (this.entries.length < this.config.threshold) {
            return false;
        }

        // Check cooldown
        if (now - this.lastAlertTime < this.config.cooldownMs) {
            return false;
        }

        return true;
    }

    /** Trigger an alert. */
    private triggerAlert(now: number): void {
        this.lastAlertTime = now;
        const rate = this.entries.length;
        const windowSec = this.config.windowMs / 1000;

        if (this.alertCallback) {
            this.alertCallback(rate, this.config.windowMs);
        } else {
            // Default: show VS Code warning
            vscode.window.showWarningMessage(
                `High error rate detected: ${rate} errors in ${windowSec}s`,
                'Open Log',
            ).then((selection) => {
                if (selection === 'Open Log') {
                    vscode.commands.executeCommand('saropaLogCapture.open');
                }
            });
        }
    }

    /** Remove entries older than the window. */
    private pruneOldEntries(now: number): void {
        const cutoff = now - this.config.windowMs;
        while (this.entries.length > 0 && this.entries[0].timestamp < cutoff) {
            this.entries.shift();
        }
    }

    /** Reset all state. */
    reset(): void {
        this.entries.length = 0;
        this.lastAlertTime = 0;
    }

    /** Get breakdown by category within current window. */
    getCategoryBreakdown(): Record<string, number> {
        this.pruneOldEntries(Date.now());
        const breakdown: Record<string, number> = {};
        for (const entry of this.entries) {
            breakdown[entry.category] = (breakdown[entry.category] ?? 0) + 1;
        }
        return breakdown;
    }
}

/**
 * Check if a log line indicates an error based on category or content.
 */
export function isErrorLine(text: string, category: string): boolean {
    if (category === 'stderr') {
        return true;
    }

    const lowerText = text.toLowerCase();
    return (
        lowerText.includes('error') ||
        lowerText.includes('exception') ||
        lowerText.includes('fatal') ||
        lowerText.includes('failed')
    );
}

/**
 * Check if a log line indicates a warning.
 */
export function isWarningLine(text: string): boolean {
    const lowerText = text.toLowerCase();
    return lowerText.includes('warn');
}
