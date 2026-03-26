"use strict";
/**
 * Session summary generation for end-of-session statistics.
 * Aggregates metrics captured during the debug session.
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
exports.generateSummary = generateSummary;
exports.withLogUri = withLogUri;
exports.formatDuration = formatDuration;
exports.formatBytes = formatBytes;
exports.showSummaryNotification = showSummaryNotification;
exports.defaultSessionStats = defaultSessionStats;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
/**
 * Generate a formatted session summary.
 */
function generateSummary(filename, stats) {
    const lines = [];
    // Duration
    const duration = formatDuration(stats.durationMs);
    lines.push(`Duration: ${duration}`);
    // Line count
    lines.push(`Lines captured: ${stats.lineCount.toLocaleString()}`);
    // File size
    const sizeStr = formatBytes(stats.bytesWritten);
    lines.push(`File size: ${sizeStr}`);
    // Parts
    if (stats.partCount > 1) {
        lines.push(`Split into ${stats.partCount} parts`);
    }
    // Category breakdown
    const categories = Object.entries(stats.categoryCounts);
    if (categories.length > 0) {
        const catStr = categories
            .filter(([, count]) => count > 0)
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(', ');
        if (catStr) {
            lines.push(`Categories: ${catStr}`);
        }
    }
    // Watch hits
    const watchHits = Object.entries(stats.watchHitCounts);
    if (watchHits.length > 0) {
        const hitStr = watchHits
            .filter(([, count]) => count > 0)
            .map(([keyword, count]) => `"${keyword}": ${count}`)
            .join(', ');
        if (hitStr) {
            lines.push(`Watch hits: ${hitStr}`);
        }
    }
    // Suppressed
    if (stats.floodSuppressedCount > 0) {
        lines.push(`Flood-suppressed: ${stats.floodSuppressedCount} messages`);
    }
    if (stats.exclusionsApplied > 0) {
        lines.push(`Exclusions applied: ${stats.exclusionsApplied}`);
    }
    return {
        title: `Session Complete: ${filename}`,
        lines,
        stats,
    };
}
/** Add logUri to a summary so "Open Log" can open the file when the session is no longer active. */
function withLogUri(summary, logUri) {
    return { ...summary, logUri };
}
/**
 * Format duration in a human-readable way.
 */
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}
/**
 * Format bytes in a human-readable way.
 */
function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}
/**
 * Show a session summary notification.
 */
function showSummaryNotification(summary) {
    const message = `${summary.title}\n${summary.lines.join(' | ')}`;
    vscode.window.showInformationMessage(message, (0, l10n_1.t)('action.openLog')).then((selection) => {
        if (selection !== (0, l10n_1.t)('action.openLog')) {
            return;
        }
        // After finalize there is no active session; open the finalized log when we have its URI.
        if (summary.logUri) {
            void vscode.window.showTextDocument(summary.logUri);
        }
        else {
            void vscode.commands.executeCommand('saropaLogCapture.open');
        }
    });
}
/**
 * Create default (empty) session stats.
 */
function defaultSessionStats() {
    return {
        lineCount: 0,
        bytesWritten: 0,
        durationMs: 0,
        partCount: 1,
        categoryCounts: {},
        watchHitCounts: {},
        floodSuppressedCount: 0,
        exclusionsApplied: 0,
    };
}
//# sourceMappingURL=session-summary.js.map