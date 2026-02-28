/** Parsed AI activity entry from a Claude Code JSONL log. */
export interface AiActivityEntry {
    readonly type: AiEntryType;
    readonly timestamp: Date;
    readonly sessionId: string;
    readonly gitBranch?: string;
    /** Claude API message ID (for assistant entries). Used for streaming dedup. */
    readonly messageId?: string;
    /** User prompt text (for 'user-prompt' type). */
    readonly promptText?: string;
    /** Tool call details (for 'tool-call' type). */
    readonly toolCall?: AiToolCall;
    /** System message content (for 'system-warning' type). */
    readonly systemMessage?: string;
}

export type AiEntryType =
    | 'user-prompt'
    | 'tool-call'
    | 'system-warning';

/** A single tool invocation extracted from a Claude Code assistant message. */
export interface AiToolCall {
    readonly toolName: string;
    readonly filePath?: string;
    readonly command?: string;
    /** True for write operations (Write, Edit, Bash). */
    readonly isMutation: boolean;
}

/** Viewer category strings for AI activity lines. */
export type AiCategory =
    | 'ai-prompt'
    | 'ai-edit'
    | 'ai-bash'
    | 'ai-read'
    | 'ai-system';

/** Map tool names to viewer categories. */
export function toolNameToCategory(toolName: string): AiCategory {
    switch (toolName) {
        case 'Write':
        case 'Edit':
        case 'NotebookEdit':
            return 'ai-edit';
        case 'Bash':
            return 'ai-bash';
        case 'Read':
        case 'Grep':
        case 'Glob':
        case 'WebFetch':
        case 'WebSearch':
            return 'ai-read';
        default:
            return 'ai-read';
    }
}

/** Mutation tools that modify files or run commands. */
const mutationTools = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash']);

/** Check whether a tool name represents a mutation (file write or command execution). */
export function isMutationTool(toolName: string): boolean {
    return mutationTools.has(toolName);
}
