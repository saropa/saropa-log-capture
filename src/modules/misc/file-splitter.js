"use strict";
/**
 * File splitter rule engine.
 * Evaluates split conditions based on configured rules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSplitter = void 0;
exports.defaultSplitRules = defaultSplitRules;
exports.parseSplitRules = parseSplitRules;
exports.formatSplitReason = formatSplitReason;
/**
 * Evaluates split rules against session state.
 * Stateless — all state is passed in via parameters.
 */
class FileSplitter {
    rules;
    keywordPatterns;
    constructor(rules) {
        this.rules = rules;
        this.keywordPatterns = rules.keywords.map(k => {
            // Check for regex pattern: /pattern/ or /pattern/flags
            const regexMatch = k.match(/^\/(.+)\/([gimsuy]*)$/);
            if (regexMatch) {
                return new RegExp(regexMatch[1], regexMatch[2] || 'i');
            }
            // Plain string - escape special chars and match case-insensitive
            return new RegExp(escapeRegex(k), 'i');
        });
    }
    /** Check if any split rule is triggered. */
    evaluate(state, lineText) {
        // Check line count
        if (this.rules.maxLines > 0 && state.lineCount >= this.rules.maxLines) {
            return {
                shouldSplit: true,
                reason: { type: 'lines', count: state.lineCount },
            };
        }
        // Check file size
        if (this.rules.maxSizeKB > 0) {
            const sizeKB = state.bytesWritten / 1024;
            if (sizeKB >= this.rules.maxSizeKB) {
                return {
                    shouldSplit: true,
                    reason: { type: 'size', sizeKB: Math.round(sizeKB) },
                };
            }
        }
        // Check duration
        if (this.rules.maxDurationMinutes > 0) {
            const elapsed = (Date.now() - state.startTime) / 60000;
            if (elapsed >= this.rules.maxDurationMinutes) {
                return {
                    shouldSplit: true,
                    reason: { type: 'duration', minutes: Math.round(elapsed) },
                };
            }
        }
        // Check silence (time since last line)
        if (this.rules.silenceMinutes > 0 && state.lastLineTime > 0) {
            const silence = (Date.now() - state.lastLineTime) / 60000;
            if (silence >= this.rules.silenceMinutes) {
                return {
                    shouldSplit: true,
                    reason: { type: 'silence', minutes: Math.round(silence) },
                };
            }
        }
        // Check keywords in current line
        if (lineText && this.keywordPatterns.length > 0) {
            for (let i = 0; i < this.keywordPatterns.length; i++) {
                if (this.keywordPatterns[i].test(lineText)) {
                    return {
                        shouldSplit: true,
                        reason: { type: 'keyword', keyword: this.rules.keywords[i] },
                    };
                }
            }
        }
        return { shouldSplit: false };
    }
    /** Check if any split rules are configured. */
    hasActiveRules() {
        return (this.rules.maxLines > 0 ||
            this.rules.maxSizeKB > 0 ||
            this.rules.keywords.length > 0 ||
            this.rules.maxDurationMinutes > 0 ||
            this.rules.silenceMinutes > 0);
    }
}
exports.FileSplitter = FileSplitter;
/** Create default (disabled) split rules. */
function defaultSplitRules() {
    return {
        maxLines: 0,
        maxSizeKB: 0,
        keywords: [],
        maxDurationMinutes: 0,
        silenceMinutes: 0,
    };
}
const MAX_LINES = 10_000_000;
const MAX_SIZE_KB = 10_000_000;
const MAX_DURATION_MINUTES = 525600; // 1 year
const MAX_SILENCE_MINUTES = 10080; // 1 week
/** Parse raw settings into SplitRules (for config loading). Clamps numbers to safe ranges. */
function parseSplitRules(raw) {
    const defaults = defaultSplitRules();
    const obj = raw && typeof raw === 'object' ? raw : {};
    const num = (v, def, max) => {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            return def;
        }
        return Math.min(v, max);
    };
    return {
        maxLines: num(obj.maxLines, defaults.maxLines, MAX_LINES),
        maxSizeKB: num(obj.maxSizeKB, defaults.maxSizeKB, MAX_SIZE_KB),
        keywords: Array.isArray(obj.keywords)
            ? obj.keywords.filter((k) => typeof k === 'string')
            : defaults.keywords,
        maxDurationMinutes: num(obj.maxDurationMinutes, defaults.maxDurationMinutes, MAX_DURATION_MINUTES),
        silenceMinutes: num(obj.silenceMinutes, defaults.silenceMinutes, MAX_SILENCE_MINUTES),
    };
}
/** Format a split reason for display in headers/logs. */
function formatSplitReason(reason) {
    switch (reason.type) {
        case 'lines':
            return `${reason.count} lines reached`;
        case 'size':
            return `${reason.sizeKB} KB size limit`;
        case 'keyword':
            return `keyword "${reason.keyword}"`;
        case 'duration':
            return `${reason.minutes} minute duration`;
        case 'silence':
            return `${reason.minutes} minute silence`;
        case 'manual':
            return 'manual split';
    }
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=file-splitter.js.map