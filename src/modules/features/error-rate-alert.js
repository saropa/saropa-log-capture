"use strict";
/**
 * Error rate monitoring and alerting.
 * Detects when error frequency exceeds thresholds and alerts the user.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRateAlert = void 0;
exports.isErrorLine = isErrorLine;
exports.isWarningLine = isWarningLine;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const l10n_1 = require("../../l10n");
/** Default configuration values. */
const DEFAULT_CONFIG = {
    enabled: true,
    windowMs: 10000, // 10 seconds
    threshold: 10, // 10 errors per window
    cooldownMs: 30000, // 30 seconds between alerts
};
/**
 * Monitors error rate using a sliding time window.
 * Alerts the user when the rate exceeds the configured threshold.
 */
class ErrorRateAlert {
    entries = [];
    lastAlertTime = 0;
    config;
    alertCallback;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Set a callback for when an alert is triggered. */
    setAlertCallback(callback) {
        this.alertCallback = callback;
    }
    /**
     * Record an error occurrence.
     * @returns true if an alert was triggered
     */
    recordError(category = 'error') {
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
    getCurrentCount() {
        this.pruneOldEntries(Date.now());
        return this.entries.length;
    }
    /** Get the current error rate (errors per minute). */
    getCurrentRate() {
        const count = this.getCurrentCount();
        const windowMinutes = this.config.windowMs / 60000;
        return count / windowMinutes;
    }
    /** Check if rate exceeds threshold and cooldown has passed. */
    shouldAlert(now) {
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
    triggerAlert(now) {
        this.lastAlertTime = now;
        const rate = this.entries.length;
        const windowSec = this.config.windowMs / 1000;
        if (this.alertCallback) {
            this.alertCallback(rate, this.config.windowMs);
        }
        else {
            // Default: show VS Code warning
            vscode.window.showWarningMessage((0, l10n_1.t)('msg.highErrorRate', String(rate), String(windowSec)), (0, l10n_1.t)('action.openLog')).then((selection) => {
                if (selection === (0, l10n_1.t)('action.openLog')) {
                    vscode.commands.executeCommand('saropaLogCapture.open');
                }
            });
        }
    }
    /** Remove entries older than the window. */
    pruneOldEntries(now) {
        const cutoff = now - this.config.windowMs;
        while (this.entries.length > 0 && this.entries[0].timestamp < cutoff) {
            this.entries.shift();
        }
    }
    /** Reset all state. */
    reset() {
        this.entries.length = 0;
        this.lastAlertTime = 0;
    }
    /** Get breakdown by category within current window. */
    getCategoryBreakdown() {
        this.pruneOldEntries(Date.now());
        const breakdown = {};
        for (const entry of this.entries) {
            breakdown[entry.category] = (breakdown[entry.category] ?? 0) + 1;
        }
        return breakdown;
    }
}
exports.ErrorRateAlert = ErrorRateAlert;
/**
 * Check if a log line indicates an error based on category or content.
 *
 * Uses word-boundary matching to avoid false positives on identifiers
 * like `__breakOnConditionalError` or `showErrorDialog`. PascalCase
 * compound types (TypeError, NullPointerException) are matched via a
 * separate pattern that requires a word boundary before the capital letter.
 */
function isErrorLine(text, category) {
    const cfg = (0, config_1.getConfig)();
    if (category === 'stderr' && cfg.stderrTreatAsError) {
        return true;
    }
    return (
    // Standalone "error"/"errors" as a whole word
    /\berrors?\b/i.test(text) ||
        // PascalCase error types: TypeError, SyntaxError, etc.
        /\b[A-Z]\w*Error\b/.test(text) ||
        // Standalone "exception"/"exceptions" as a whole word
        /\bexceptions?\b/i.test(text) ||
        // PascalCase exception types: NullPointerException, etc.
        /\b[A-Z]\w*Exception\b/.test(text) ||
        /\bfatal\b/i.test(text) ||
        /\bfailed\b/i.test(text) ||
        // Logcat E/ (error), F/ (fatal), A/ (assert) prefixes
        /^[efa]\/\S/i.test(text));
}
/**
 * Check if a log line indicates a warning.
 *
 * Uses word-boundary matching to avoid false positives on identifiers
 * like `showWarningDialog`. PascalCase compound types (DeprecationWarning)
 * are matched via a separate pattern requiring a leading word boundary.
 */
function isWarningLine(text) {
    return (
    // Standalone "warn"/"warning"/"warnings" as a whole word
    /\bwarn(ings?)?\b/i.test(text) ||
        // PascalCase warning types: DeprecationWarning, etc.
        /\b[A-Z]\w*Warning\b/.test(text) ||
        // Logcat W/ prefix (e.g. "W/SomeTag: ...")
        /^w\/\S/i.test(text));
}
//# sourceMappingURL=error-rate-alert.js.map