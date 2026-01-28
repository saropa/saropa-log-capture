/**
 * File splitter rule engine.
 * Evaluates split conditions based on configured rules.
 */

/** Configuration for automatic file splitting. */
export interface SplitRules {
    readonly maxLines: number;
    readonly maxSizeKB: number;
    readonly keywords: readonly string[];
    readonly maxDurationMinutes: number;
    readonly silenceMinutes: number;
}

/** Reason why a split was triggered. */
export type SplitReason =
    | { type: 'lines'; count: number }
    | { type: 'size'; sizeKB: number }
    | { type: 'keyword'; keyword: string }
    | { type: 'duration'; minutes: number }
    | { type: 'silence'; minutes: number }
    | { type: 'manual' };

/** Result of evaluating whether to split. */
export interface SplitEvaluation {
    readonly shouldSplit: boolean;
    readonly reason?: SplitReason;
}

/**
 * Evaluates split rules against session state.
 * Stateless — all state is passed in via parameters.
 */
export class FileSplitter {
    private readonly keywordPatterns: RegExp[];

    constructor(private readonly rules: SplitRules) {
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
    evaluate(state: SplitState, lineText?: string): SplitEvaluation {
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
    hasActiveRules(): boolean {
        return (
            this.rules.maxLines > 0 ||
            this.rules.maxSizeKB > 0 ||
            this.rules.keywords.length > 0 ||
            this.rules.maxDurationMinutes > 0 ||
            this.rules.silenceMinutes > 0
        );
    }
}

/** State tracked for split evaluation. */
export interface SplitState {
    readonly lineCount: number;
    readonly bytesWritten: number;
    readonly startTime: number;
    readonly lastLineTime: number;
}

/** Create default (disabled) split rules. */
export function defaultSplitRules(): SplitRules {
    return {
        maxLines: 0,
        maxSizeKB: 0,
        keywords: [],
        maxDurationMinutes: 0,
        silenceMinutes: 0,
    };
}

/** Format a split reason for display in headers/logs. */
export function formatSplitReason(reason: SplitReason): string {
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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
