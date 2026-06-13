import { addNormalizedToken, collectTokens, MAX_TOKENS_PER_FILE, normalizeQuotedValue, stripCommentPreservingQuotes } from './token-extractor-common';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Max JSON nesting walked. The token cap bounds breadth; this bounds DEPTH so a pathologically
 *  nested document can't overflow the recursion stack. 64 is far deeper than any real config. */
const MAX_JSON_DEPTH = 64;

/** Extract tokens from JSON: keys, key paths, and string values. */
export function extractTokensFromJson(content: string): string[] {
    const set = new Set<string>();
    const cap = MAX_TOKENS_PER_FILE;
    // Closure over `set`/`cap` keeps the recursive walker to 3 params (value, path, depth) and bounds
    // recursion depth so a pathologically nested document can't overflow the stack.
    const walk = (value: JsonValue, pathSegments: string[], depth: number): void => {
        if (set.size >= cap || depth > MAX_JSON_DEPTH) { return; }
        if (Array.isArray(value)) {
            for (const child of value) {
                if (set.size >= cap) { return; }
                walk(child, pathSegments, depth + 1);
            }
            return;
        }
        if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                if (set.size >= cap) { return; }
                collectTokens(key, set, cap);
                const nextPath = [...pathSegments, key];
                addNormalizedToken(nextPath.join('.'), set, cap);
                walk(child, nextPath, depth + 1);
            }
            return;
        }
        if (typeof value === 'string') {
            collectTokens(value, set, cap);
        }
    };
    try {
        walk(JSON.parse(content) as JsonValue, [], 0);
    } catch {
        collectTokens(content, set, cap);
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
