/**
 * Converts parsed AI activity entries into LineData objects
 * compatible with the ViewerBroadcaster pipeline.
 */

import { AiActivityEntry, AiCategory, toolNameToCategory } from './ai-jsonl-types';
import { AiActivityConfig } from './config';
import { LineData } from './session-manager';

/** Read-only tools that are hidden unless showReadOperations is true. */
const readTools = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']);

/** Filter AI entries according to user settings. */
export function filterAiEntries(
    entries: readonly AiActivityEntry[],
    cfg: AiActivityConfig,
): AiActivityEntry[] {
    return entries.filter(entry => {
        if (entry.type === 'user-prompt') { return cfg.showPrompts; }
        if (entry.type === 'system-warning') { return cfg.showSystemWarnings; }
        if (entry.type === 'tool-call' && entry.toolCall) {
            if (readTools.has(entry.toolCall.toolName)) { return cfg.showReadOperations; }
        }
        return true;
    });
}

/** Maximum length for displayed file paths (truncated from the left). */
const maxPathDisplay = 60;

/** Maximum length for displayed Bash commands. */
const maxCommandDisplay = 80;

/** Maximum length for displayed user prompts. */
const maxPromptDisplay = 120;

/** Convert an AI activity entry into a LineData for the broadcaster. */
export function formatAiEntry(entry: AiActivityEntry): LineData {
    switch (entry.type) {
        case 'user-prompt': return formatPrompt(entry);
        case 'tool-call': return formatToolCall(entry);
        case 'system-warning': return formatSystemWarning(entry);
    }
}

function formatPrompt(entry: AiActivityEntry): LineData {
    const text = truncate(entry.promptText ?? '', maxPromptDisplay);
    return buildLineData(`[AI Ask] ${text}`, 'ai-prompt', entry);
}

function formatToolCall(entry: AiActivityEntry): LineData {
    const call = entry.toolCall;
    if (!call) { return buildLineData('[AI] Unknown tool', 'ai-read', entry); }
    const category = toolNameToCategory(call.toolName);
    const text = formatToolText(call.toolName, call.filePath, call.command);
    return buildLineData(text, category, entry);
}

function formatToolText(toolName: string, filePath?: string, command?: string): string {
    const prefix = `[AI ${toolName}]`;
    if (filePath) {
        return `${prefix} ${truncatePath(filePath)}`;
    }
    if (command) {
        return `${prefix} ${truncate(command, maxCommandDisplay)}`;
    }
    return prefix;
}

function formatSystemWarning(entry: AiActivityEntry): LineData {
    const msg = truncate(entry.systemMessage ?? '', maxPromptDisplay);
    return buildLineData(`[AI Warn] ${msg}`, 'ai-system', entry);
}

function buildLineData(text: string, category: AiCategory, entry: AiActivityEntry): LineData {
    return {
        text,
        isMarker: false,
        lineCount: 0,
        category,
        timestamp: entry.timestamp,
    };
}

/** Truncate a string to maxLen, appending "..." if truncated. */
function truncate(text: string, maxLen: number): string {
    const singleLine = text.replace(/[\r\n]+/g, ' ').trim();
    if (singleLine.length <= maxLen) { return singleLine; }
    return singleLine.substring(0, maxLen - 3) + '...';
}

/** Truncate a file path from the left, showing the most relevant tail. */
function truncatePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.length <= maxPathDisplay) { return normalized; }
    return '...' + normalized.slice(-(maxPathDisplay - 3));
}
