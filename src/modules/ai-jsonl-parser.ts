/**
 * Lightweight parser for Claude Code JSONL session logs.
 *
 * Extracts user prompts, tool calls, and system warnings from the
 * raw JSONL format written by Claude Code to ~/.claude/projects/.
 * Intentionally minimal — no dependency on saropa-claude-guard.
 */

import { AiActivityEntry, AiToolCall, isMutationTool } from './ai-jsonl-types';

/** Tools whose invocations we surface in the viewer. */
const relevantTools = new Set([
    'Write', 'Edit', 'NotebookEdit', 'Bash',
    'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
]);

/** Tags injected by the IDE that aren't real user prompts. */
const ideTagPattern = /^<ide_\w+>/;

/** Regex to extract assistant message ID without a full JSON parse. */
const msgIdPattern = /"id"\s*:\s*"(msg_[^"]+)"/;

/**
 * Parse a chunk of JSONL text into AI activity entries.
 * Deduplicates streaming assistant messages by message ID — Claude Code
 * appends multiple lines per message as it streams, each more complete
 * than the last. Only the final (most complete) version is kept.
 */
export function parseJsonlChunk(chunk: string): AiActivityEntry[] {
    const deduped = deduplicateAssistantLines(chunk.split('\n'));
    const results: AiActivityEntry[] = [];
    for (const line of deduped) {
        const entry = parseSingleLine(line);
        if (entry) { results.push(...entry); }
    }
    return results;
}

/** Keep only the last JSONL line per assistant message ID. */
function deduplicateAssistantLines(lines: string[]): string[] {
    const lastIndex = new Map<string, number>();
    const trimmed: string[] = [];
    for (const raw of lines) {
        const t = raw.trim();
        if (!t) { continue; }
        trimmed.push(t);
        const m = msgIdPattern.exec(t);
        if (m) { lastIndex.set(m[1], trimmed.length - 1); }
    }
    return trimmed.filter((line, idx) => {
        const m = msgIdPattern.exec(line);
        return !m || lastIndex.get(m[1]) === idx;
    });
}

/** Parse one JSONL line. Returns zero or more entries (one per tool call). */
function parseSingleLine(line: string): AiActivityEntry[] | null {
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line) as Record<string, unknown>; }
    catch { return null; }

    const type = obj.type as string | undefined;
    if (!type) { return null; }
    if (obj.isSidechain === true) { return null; }

    switch (type) {
        case 'user': return parseUserEntry(obj);
        case 'assistant': return parseAssistantEntry(obj);
        case 'system': return parseSystemEntry(obj);
        default: return null;
    }
}

/** Extract user prompt text (skipping IDE-injected context and tool results). */
function parseUserEntry(obj: Record<string, unknown>): AiActivityEntry[] | null {
    if (obj.userType !== 'external') { return null; }
    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) { return null; }
    const content = msg.content as unknown[] | undefined;
    if (!Array.isArray(content)) { return null; }

    const texts: string[] = [];
    for (const block of content) {
        if (!isTextBlock(block)) { continue; }
        const text = (block as Record<string, unknown>).text as string;
        if (ideTagPattern.test(text)) { continue; }
        if (text.includes('tool_result')) { continue; }
        texts.push(text.trim());
    }
    if (texts.length === 0) { return null; }
    const promptText = texts.join(' ').substring(0, 200);
    return [{
        type: 'user-prompt',
        timestamp: parseTimestamp(obj),
        sessionId: String(obj.sessionId ?? ''),
        gitBranch: obj.gitBranch as string | undefined,
        promptText,
    }];
}

/** Extract tool_use blocks from assistant messages. */
function parseAssistantEntry(obj: Record<string, unknown>): AiActivityEntry[] | null {
    if (obj.isApiErrorMessage === true) { return null; }
    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) { return null; }
    const content = msg.content as unknown[] | undefined;
    if (!Array.isArray(content)) { return null; }

    const results: AiActivityEntry[] = [];
    const sessionId = String(obj.sessionId ?? '');
    const timestamp = parseTimestamp(obj);
    const gitBranch = obj.gitBranch as string | undefined;
    const messageId = msg.id as string | undefined;

    for (const block of content) {
        const toolCall = extractToolCall(block);
        if (toolCall) {
            results.push({ type: 'tool-call', timestamp, sessionId, gitBranch, messageId, toolCall });
        }
    }
    return results.length > 0 ? results : null;
}

/** Extract a tool call from a content block if it's a relevant tool_use. */
function extractToolCall(block: unknown): AiToolCall | null {
    if (!isToolUseBlock(block)) { return null; }
    const b = block as Record<string, unknown>;
    const toolName = b.name as string;
    if (!relevantTools.has(toolName)) { return null; }
    const input = (b.input ?? {}) as Record<string, unknown>;
    return {
        toolName,
        filePath: input.file_path as string | undefined,
        command: input.command as string | undefined,
        isMutation: isMutationTool(toolName),
    };
}

/** Parse system-level warnings and errors. */
function parseSystemEntry(obj: Record<string, unknown>): AiActivityEntry[] | null {
    const level = obj.level as string | undefined;
    if (level !== 'warning' && level !== 'error') { return null; }
    const content = obj.content as string | undefined;
    if (!content) { return null; }
    return [{
        type: 'system-warning',
        timestamp: parseTimestamp(obj),
        sessionId: String(obj.sessionId ?? ''),
        systemMessage: content.substring(0, 300),
    }];
}

function parseTimestamp(obj: Record<string, unknown>): Date {
    const ts = obj.timestamp as string | undefined;
    return ts ? new Date(ts) : new Date();
}

function isTextBlock(block: unknown): boolean {
    if (typeof block !== 'object' || block === null) { return false; }
    return (block as Record<string, unknown>).type === 'text';
}

function isToolUseBlock(block: unknown): boolean {
    if (typeof block !== 'object' || block === null) { return false; }
    return (block as Record<string, unknown>).type === 'tool_use';
}
