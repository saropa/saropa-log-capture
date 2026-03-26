"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractHeadings = extractHeadings;
exports.extractTokensFromMarkdown = extractTokensFromMarkdown;
const token_extractor_common_1 = require("./token-extractor-common");
/** Extract H1–H3 headings from markdown. Line is 1-based. */
function extractHeadings(content) {
    const headings = [];
    const lines = content.split(/\r?\n/);
    const re = /^(#{1,3})\s+(.+)$/;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (m) {
            headings.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
        }
    }
    return headings;
}
/** Extract tokens from markdown: headings (2x), code blocks, bold/italic, links, then rest. */
function extractTokensFromMarkdown(content) {
    const headings = extractHeadings(content);
    const set = new Set();
    const cap = token_extractor_common_1.MAX_TOKENS_PER_FILE;
    for (const h of headings) {
        if (set.size >= cap) {
            break;
        }
        (0, token_extractor_common_1.collectTokens)(h.text, set, cap);
    }
    const codeBlockRe = /```[\s\S]*?```/g;
    const noCode = content.replace(codeBlockRe, ' ');
    const boldRe = /\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_/g;
    let m;
    while ((m = boldRe.exec(noCode)) !== null && set.size < cap) {
        const t = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
        if (t) {
            (0, token_extractor_common_1.collectTokens)(t, set, cap);
        }
    }
    const linkRe = /\[([^\]]+)\]\([^)]+\)/g;
    while ((m = linkRe.exec(noCode)) !== null && set.size < cap) {
        (0, token_extractor_common_1.collectTokens)(m[1], set, cap);
    }
    (0, token_extractor_common_1.collectTokens)(noCode.replace(/```[\s\S]*?```/g, ' '), set, cap);
    return { tokens: [...set], headings };
}
//# sourceMappingURL=token-extractor-markdown.js.map