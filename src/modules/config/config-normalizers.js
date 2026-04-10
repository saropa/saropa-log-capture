"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WATCH_PATTERNS = exports.DEFAULT_FILE_TYPES = exports.DEFAULT_CATEGORIES = void 0;
exports.normalizeWatchPatterns = normalizeWatchPatterns;
exports.normalizeHighlightRules = normalizeHighlightRules;
exports.normalizeAutoTagRules = normalizeAutoTagRules;
const config_default_highlight_rules_1 = require("./config-default-highlight-rules");
exports.DEFAULT_CATEGORIES = ["console", "stdout", "stderr"];
exports.DEFAULT_FILE_TYPES = [".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html"];
exports.DEFAULT_WATCH_PATTERNS = [
    { keyword: "error", alert: "flash" },
    { keyword: "exception", alert: "badge" },
    { keyword: "warning", alert: "badge" },
];
function asObjectRecord(value) {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    return value;
}
function readOptionalString(o, key) {
    const v = o[key];
    return typeof v === "string" ? v : undefined;
}
function readOptionalScope(o) {
    const v = o.scope;
    if (v === "line") {
        return "line";
    }
    if (v === "keyword") {
        return "keyword";
    }
    return undefined;
}
function readPattern(o) {
    const v = o.pattern;
    if (typeof v !== "string") {
        return undefined;
    }
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}
function readBooleanOrFalse(o, key) {
    const v = o[key];
    return typeof v === "boolean" ? v : false;
}
function normalizeWatchPatterns(raw) {
    if (!Array.isArray(raw)) {
        return exports.DEFAULT_WATCH_PATTERNS;
    }
    const alertValues = ["flash", "badge", "none"];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const o = item;
        const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
        if (!keyword) {
            continue;
        }
        const alert = typeof o.alert === "string" && alertValues.includes(o.alert)
            ? o.alert
            : "badge";
        out.push({ keyword, alert });
    }
    return out.length > 0 ? out : exports.DEFAULT_WATCH_PATTERNS;
}
function normalizeHighlightRuleItem(item) {
    const o = asObjectRecord(item);
    if (!o) {
        return undefined;
    }
    const pattern = readPattern(o);
    if (!pattern) {
        return undefined;
    }
    return {
        pattern,
        color: readOptionalString(o, "color"),
        label: readOptionalString(o, "label"),
        bold: readBooleanOrFalse(o, "bold"),
        italic: readBooleanOrFalse(o, "italic"),
        scope: readOptionalScope(o),
        backgroundColor: readOptionalString(o, "backgroundColor"),
    };
}
function normalizeHighlightRules(raw) {
    if (!Array.isArray(raw)) {
        return (0, config_default_highlight_rules_1.defaultHighlightRules)();
    }
    const out = [];
    for (const item of raw) {
        const rule = normalizeHighlightRuleItem(item);
        if (rule) {
            out.push(rule);
        }
    }
    return out.length > 0 ? out : (0, config_default_highlight_rules_1.defaultHighlightRules)();
}
function normalizeAutoTagRules(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => {
        if (!item || typeof item !== "object") {
            return null;
        }
        const o = item;
        const pattern = typeof o.pattern === "string" ? o.pattern.trim() : "";
        const tag = typeof o.tag === "string" ? o.tag.trim() : "";
        if (!pattern || !tag) {
            return null;
        }
        return { pattern, tag };
    })
        .filter((r) => r !== null);
}
//# sourceMappingURL=config-normalizers.js.map