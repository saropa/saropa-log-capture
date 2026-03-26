"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokensFromJson = extractTokensFromJson;
exports.extractTokensFromYaml = extractTokensFromYaml;
exports.extractTokensFromToml = extractTokensFromToml;
exports.extractTokensFromArb = extractTokensFromArb;
exports.extractTokensFromKeyValueText = extractTokensFromKeyValueText;
const token_extractor_common_1 = require("./token-extractor-common");
function walkJsonTokens(value, pathSegments, into, cap) {
    if (into.size >= cap) {
        return;
    }
    if (Array.isArray(value)) {
        for (const child of value) {
            if (into.size >= cap) {
                return;
            }
            walkJsonTokens(child, pathSegments, into, cap);
        }
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            if (into.size >= cap) {
                return;
            }
            (0, token_extractor_common_1.collectTokens)(key, into, cap);
            const nextPath = [...pathSegments, key];
            (0, token_extractor_common_1.addNormalizedToken)(nextPath.join('.'), into, cap);
            walkJsonTokens(child, nextPath, into, cap);
        }
        return;
    }
    if (typeof value === 'string') {
        (0, token_extractor_common_1.collectTokens)(value, into, cap);
    }
}
/** Extract tokens from JSON: keys, key paths, and string values. */
function extractTokensFromJson(content) {
    const set = new Set();
    try {
        const parsed = JSON.parse(content);
        walkJsonTokens(parsed, [], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    catch {
        (0, token_extractor_common_1.collectTokens)(content, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from YAML: keys, key paths, and scalar string values. */
function extractTokensFromYaml(content) {
    const set = new Set();
    const lines = content.split(/\r?\n/);
    const stack = [];
    for (const rawLine of lines) {
        const noComment = (0, token_extractor_common_1.stripCommentPreservingQuotes)(rawLine);
        const line = noComment.trimEnd();
        if (!line.trim() || line.trimStart().startsWith('- ')) {
            continue;
        }
        const indent = rawLine.search(/\S|$/);
        const keyMatch = line.trimStart().match(/^["']?([A-Za-z0-9._-]+)["']?\s*:\s*(.*)$/);
        if (!keyMatch) {
            continue;
        }
        while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
        }
        const key = keyMatch[1];
        (0, token_extractor_common_1.collectTokens)(key, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        const path = [...stack.map((s) => s.key), key];
        (0, token_extractor_common_1.addNormalizedToken)(path.join('.'), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        stack.push({ indent, key });
        const value = (0, token_extractor_common_1.normalizeQuotedValue)(keyMatch[2]);
        if (!value) {
            continue;
        }
        if (value.startsWith('[') || value.startsWith('{') || value === '|' || value === '>') {
            continue;
        }
        if (/^(true|false|null|~|\d+(\.\d+)?)$/i.test(value)) {
            continue;
        }
        (0, token_extractor_common_1.collectTokens)(value, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from TOML: keys, key paths, table names, and string values. */
function extractTokensFromToml(content) {
    const set = new Set();
    const lines = content.split(/\r?\n/);
    let currentTable = [];
    for (const rawLine of lines) {
        const noComment = (0, token_extractor_common_1.stripCommentPreservingQuotes)(rawLine).trim();
        if (!noComment) {
            continue;
        }
        const table = noComment.match(/^\[\[?([^\]]+)\]\]?$/);
        if (table) {
            currentTable = table[1].split('.').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            for (const segment of currentTable) {
                (0, token_extractor_common_1.collectTokens)(segment, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            }
            (0, token_extractor_common_1.addNormalizedToken)(currentTable.join('.'), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            continue;
        }
        const kv = noComment.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
        if (!kv) {
            continue;
        }
        const key = kv[1];
        const valueRaw = kv[2].trim();
        (0, token_extractor_common_1.collectTokens)(key, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        (0, token_extractor_common_1.addNormalizedToken)([...currentTable, key].join('.'), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        const quoted = valueRaw.match(/^"([^"]*)"|'([^']*)'$/);
        if (quoted) {
            (0, token_extractor_common_1.collectTokens)(quoted[1] ?? quoted[2] ?? '', set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            continue;
        }
        if (valueRaw.startsWith('[') || valueRaw.startsWith('{')) {
            continue;
        }
        if (/^(true|false|[+-]?\d+(\.\d+)?)$/i.test(valueRaw)) {
            continue;
        }
        (0, token_extractor_common_1.collectTokens)(valueRaw, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
    }
    return [...set];
}
/** Extract tokens from ARB files (JSON + ICU message strings). */
function extractTokensFromArb(content) {
    return extractTokensFromJson(content);
}
/** Extract tokens from key-value config files (.ini/.cfg/.conf/.properties/.env*). */
function extractTokensFromKeyValueText(content) {
    const set = new Set();
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) {
            continue;
        }
        if (line.startsWith('[') && line.endsWith(']')) {
            (0, token_extractor_common_1.collectTokens)(line.slice(1, -1), set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            continue;
        }
        const kv = line.match(/^([A-Za-z0-9._-]+)\s*[:=]\s*(.*)$/);
        if (!kv) {
            (0, token_extractor_common_1.collectTokens)(line, set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
            continue;
        }
        (0, token_extractor_common_1.collectTokens)(kv[1], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        if (kv[2]) {
            (0, token_extractor_common_1.collectTokens)(kv[2], set, token_extractor_common_1.MAX_TOKENS_PER_FILE);
        }
    }
    return [...set];
}
//# sourceMappingURL=token-extractor-config.js.map