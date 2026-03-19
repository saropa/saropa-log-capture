import { addNormalizedToken, collectTokens, MAX_TOKENS_PER_FILE, normalizeQuotedValue, stripCommentPreservingQuotes } from './token-extractor-common';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function walkJsonTokens(value: JsonValue, pathSegments: string[], into: Set<string>, cap: number): void {
    if (into.size >= cap) { return; }
    if (Array.isArray(value)) {
        for (const child of value) {
            if (into.size >= cap) { return; }
            walkJsonTokens(child, pathSegments, into, cap);
        }
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            if (into.size >= cap) { return; }
            collectTokens(key, into, cap);
            const nextPath = [...pathSegments, key];
            addNormalizedToken(nextPath.join('.'), into, cap);
            walkJsonTokens(child, nextPath, into, cap);
        }
        return;
    }
    if (typeof value === 'string') {
        collectTokens(value, into, cap);
    }
}

/** Extract tokens from JSON: keys, key paths, and string values. */
export function extractTokensFromJson(content: string): string[] {
    const set = new Set<string>();
    try {
        const parsed = JSON.parse(content) as JsonValue;
        walkJsonTokens(parsed, [], set, MAX_TOKENS_PER_FILE);
    } catch {
        collectTokens(content, set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

interface YamlStackEntry {
    readonly indent: number;
    readonly key: string;
}

/** Extract tokens from YAML: keys, key paths, and scalar string values. */
export function extractTokensFromYaml(content: string): string[] {
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    const stack: YamlStackEntry[] = [];
    for (const rawLine of lines) {
        const noComment = stripCommentPreservingQuotes(rawLine);
        const line = noComment.trimEnd();
        if (!line.trim() || line.trimStart().startsWith('- ')) { continue; }
        const indent = rawLine.search(/\S|$/);
        const keyMatch = line.trimStart().match(/^["']?([A-Za-z0-9._-]+)["']?\s*:\s*(.*)$/);
        if (!keyMatch) { continue; }
        while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
        }
        const key = keyMatch[1];
        collectTokens(key, set, MAX_TOKENS_PER_FILE);
        const path = [...stack.map((s) => s.key), key];
        addNormalizedToken(path.join('.'), set, MAX_TOKENS_PER_FILE);
        stack.push({ indent, key });
        const value = normalizeQuotedValue(keyMatch[2]);
        if (!value) { continue; }
        if (value.startsWith('[') || value.startsWith('{') || value === '|' || value === '>') { continue; }
        if (/^(true|false|null|~|\d+(\.\d+)?)$/i.test(value)) { continue; }
        collectTokens(value, set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from TOML: keys, key paths, table names, and string values. */
export function extractTokensFromToml(content: string): string[] {
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    let currentTable: string[] = [];
    for (const rawLine of lines) {
        const noComment = stripCommentPreservingQuotes(rawLine).trim();
        if (!noComment) { continue; }
        const table = noComment.match(/^\[\[?([^\]]+)\]\]?$/);
        if (table) {
            currentTable = table[1].split('.').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            for (const segment of currentTable) {
                collectTokens(segment, set, MAX_TOKENS_PER_FILE);
            }
            addNormalizedToken(currentTable.join('.'), set, MAX_TOKENS_PER_FILE);
            continue;
        }
        const kv = noComment.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
        if (!kv) { continue; }
        const key = kv[1];
        const valueRaw = kv[2].trim();
        collectTokens(key, set, MAX_TOKENS_PER_FILE);
        addNormalizedToken([...currentTable, key].join('.'), set, MAX_TOKENS_PER_FILE);
        const quoted = valueRaw.match(/^"([^"]*)"|'([^']*)'$/);
        if (quoted) {
            collectTokens(quoted[1] ?? quoted[2] ?? '', set, MAX_TOKENS_PER_FILE);
            continue;
        }
        if (valueRaw.startsWith('[') || valueRaw.startsWith('{')) { continue; }
        if (/^(true|false|[+-]?\d+(\.\d+)?)$/i.test(valueRaw)) { continue; }
        collectTokens(valueRaw, set, MAX_TOKENS_PER_FILE);
    }
    return [...set];
}

/** Extract tokens from ARB files (JSON + ICU message strings). */
export function extractTokensFromArb(content: string): string[] {
    return extractTokensFromJson(content);
}

/** Extract tokens from key-value config files (.ini/.cfg/.conf/.properties/.env*). */
export function extractTokensFromKeyValueText(content: string): string[] {
    const set = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) { continue; }
        if (line.startsWith('[') && line.endsWith(']')) {
            collectTokens(line.slice(1, -1), set, MAX_TOKENS_PER_FILE);
            continue;
        }
        const kv = line.match(/^([A-Za-z0-9._-]+)\s*[:=]\s*(.*)$/);
        if (!kv) {
            collectTokens(line, set, MAX_TOKENS_PER_FILE);
            continue;
        }
        collectTokens(kv[1], set, MAX_TOKENS_PER_FILE);
        if (kv[2]) { collectTokens(kv[2], set, MAX_TOKENS_PER_FILE); }
    }
    return [...set];
}
