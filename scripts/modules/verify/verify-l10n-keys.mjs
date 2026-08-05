/**
 * Verify that every l10n key reachable from src/ is defined in the catalog (src/l10n/strings-*.ts).
 * An undefined key ships as a raw "namespace.key" string shown to the user.
 *
 * Four layers:
 *  1. Literal keys — t('a.b.c') / vt('a.b.c') referenced in src/.
 *  2. @l10n-expand tags — a JSDoc tag on a function declares key templates with arg-position
 *     placeholders (e.g. `@l10n-expand viewer.session.{2}.title`). The lint finds every call
 *     to that function across ALL files, resolves `{N}` to the Nth string-literal argument
 *     (0-based), and checks each expanded key exists. Cross-file by design.
 *  3. @l10n-family annotations — `// @l10n-family .title .label .text` in catalog files.
 *     Every key in the contiguous block below must have entries for every declared suffix.
 *  4. Dynamic fallback — t(`prefix.${var}.suffix`) patterns (heuristic, same-file only).
 *     Kept as a safety net; @l10n-expand is preferred for new code.
 *
 * Scope: Tests (src/test/**) are skipped. Dynamic concatenation (t('a.' + x)) and
 * non-namespaced keys (no '.') are ignored.
 *
 * Run: node scripts/modules/verify/verify-l10n-keys.mjs   (wired into `npm run compile`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve('src');
const L10N = path.join(SRC, 'l10n');

function collectTsFiles(dir, skipPrefixes) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (skipPrefixes.some((p) => full.startsWith(p))) { continue; }
        if (entry.isDirectory()) { out.push(...collectTsFiles(full, skipPrefixes)); }
        else if (entry.name.endsWith('.ts')) { out.push(full); }
    }
    return out;
}

function definedKeys() {
    const keys = new Set();
    for (const file of fs.readdirSync(L10N)) {
        if (!/^strings.*\.ts$/.test(file)) { continue; }
        const text = fs.readFileSync(path.join(L10N, file), 'utf-8');
        for (const m of text.matchAll(/['"]([a-zA-Z0-9._-]+)['"]\s*:/g)) { keys.add(m[1]); }
    }
    return keys;
}

function referencedKeys() {
    const refs = new Map();
    const skip = [path.join(SRC, 'test')];
    for (const file of collectTsFiles(SRC, skip)) {
        const text = fs.readFileSync(file, 'utf-8');
        for (const m of text.matchAll(/\b(?:t|vt)\((['"])([a-zA-Z][a-zA-Z0-9._-]+)\1/g)) {
            const key = m[2];
            if (!key.includes('.') || key.endsWith('.')) { continue; }
            if (!refs.has(key)) { refs.set(key, new Set()); }
            refs.get(key).add(path.relative(SRC, file));
        }
    }
    return refs;
}

// ── Layer 2: @l10n-expand ──────────────────────────────────────────────

/** Parse `@l10n-expand pattern1 pattern2` from JSDoc/block comments above function declarations. */
function collectExpandTags(files) {
    // funcName -> { patterns: string[], file: string }
    const tags = new Map();
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf-8');
        for (const m of text.matchAll(/@l10n-expand\s+(.+?)(?:\*\/|\*\s|\n)/g)) {
            const patterns = m[1].trim().split(/\s+/);
            // Find the function name on the next `function` line after the tag
            const after = text.slice(m.index + m[0].length);
            const funcMatch = after.match(/function\s+(\w+)\s*\(/);
            if (funcMatch) { tags.set(funcMatch[1], { patterns, file }); }
        }
    }
    return tags;
}

/** Find calls to tagged functions across all files and expand key templates. */
function expandTaggedCalls(defined, files) {
    const tags = collectExpandTags(files);
    if (tags.size === 0) { return []; }
    const missing = [];
    // Build a regex that matches calls to any tagged function
    const funcNames = [...tags.keys()].join('|');
    const callRe = new RegExp(`\\b(${funcNames})\\(([^)]+)\\)`, 'g');
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf-8');
        for (const cm of text.matchAll(callRe)) {
            const tag = tags.get(cm[1]);
            if (!tag) { continue; }
            // Parse arguments: split on commas, respecting string literals
            const args = parseArgs(cm[2]);
            for (const pattern of tag.patterns) {
                const key = pattern.replace(/\{(\d+)\}/g, (_, idx) => {
                    const a = args[Number(idx)];
                    // Only resolve string-literal args (quoted)
                    if (a && /^['"](.+)['"]$/.test(a.trim())) {
                        return a.trim().slice(1, -1);
                    }
                    return `{${idx}}`;
                });
                // Skip unresolved patterns (non-literal args)
                if (/\{\d+\}/.test(key)) { continue; }
                if (!defined.has(key)) {
                    missing.push({ key, file: path.relative(SRC, file) });
                }
            }
        }
    }
    return missing;
}

/** Split function-call arguments on commas, respecting quotes and nested parens. */
function parseArgs(argsStr) {
    const args = [];
    let depth = 0, current = '', inQ = '';
    for (const ch of argsStr) {
        if (inQ) { current += ch; if (ch === inQ) { inQ = ''; } continue; }
        if (ch === '\'' || ch === '"' || ch === '`') { inQ = ch; current += ch; continue; }
        if (ch === '(') { depth++; current += ch; continue; }
        if (ch === ')') { depth--; current += ch; continue; }
        if (ch === ',' && depth === 0) { args.push(current); current = ''; continue; }
        current += ch;
    }
    if (current) { args.push(current); }
    return args;
}

// ── Layer 3: @l10n-family ──────────────────────────────────────────────

function annotatedFamilies(defined) {
    const missing = [];
    for (const file of fs.readdirSync(L10N)) {
        if (!/^strings.*\.ts$/.test(file)) { continue; }
        const text = fs.readFileSync(path.join(L10N, file), 'utf-8');
        const lines = text.split('\n');
        let suffixes = null, bases = null;
        for (const line of lines) {
            const fm = line.match(/\/\/\s*@l10n-family\s+(.+)/);
            if (fm) {
                if (suffixes && bases) { flushFamily(suffixes, bases, file, missing, defined); }
                suffixes = fm[1].trim().split(/\s+/).filter((s) => s.startsWith('.'));
                bases = new Map();
                continue;
            }
            if (!suffixes) { continue; }
            const km = line.match(/['"]([a-zA-Z0-9._-]+)['"]\s*:/);
            if (!km) {
                if (suffixes && bases) { flushFamily(suffixes, bases, file, missing, defined); }
                suffixes = null; bases = null;
                continue;
            }
            for (const sfx of suffixes) {
                if (km[1].endsWith(sfx)) {
                    const base = km[1].slice(0, -sfx.length);
                    if (!bases.has(base)) { bases.set(base, new Set()); }
                    bases.get(base).add(sfx);
                    break;
                }
            }
        }
        if (suffixes && bases) { flushFamily(suffixes, bases, file, missing, defined); }
    }
    return missing;
}

function flushFamily(suffixes, bases, file, missing, defined) {
    for (const [base, found] of bases) {
        for (const sfx of suffixes) {
            const key = `${base}${sfx}`;
            if (!found.has(sfx) && !defined.has(key)) { missing.push({ key, file }); }
        }
    }
}

// ── Layer 4: dynamic fallback ──────────────────────────────────────────

function dynamicKeyFamilies(defined, files) {
    const missing = [];
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf-8');
        const tplRe = /\bt\(`([a-zA-Z0-9._-]+)\.\$\{(\w+)\}\.([a-zA-Z0-9_-]+)`/g;
        const families = new Map();
        for (const m of text.matchAll(tplRe)) {
            const pfx = m[1];
            if (!families.has(pfx)) { families.set(pfx, new Set()); }
            families.get(pfx).add(m[3]);
        }
        for (const [pfx, sfxs] of families) {
            if (sfxs.size < 2) { continue; }
            const sfxArr = [...sfxs];
            const literals = new Set();
            for (const lm of text.matchAll(/['"]([a-zA-Z][a-zA-Z0-9_-]*)[']/g)) {
                literals.add(lm[1]);
            }
            for (const base of literals) {
                if (!sfxArr.some((s) => defined.has(`${pfx}.${base}.${s}`))) { continue; }
                for (const sfx of sfxArr) {
                    const key = `${pfx}.${base}.${sfx}`;
                    if (!defined.has(key)) { missing.push({ key, file: path.relative(SRC, file) }); }
                }
            }
        }
    }
    return missing;
}

// ── Main ────────────────────────────────────────────────────────────────

const defined = definedKeys();
const skip = [path.join(SRC, 'test')];
const allFiles = collectTsFiles(SRC, skip);

const literalMissing = [...referencedKeys()].filter(([key]) => !defined.has(key));
const expandMissing = expandTaggedCalls(defined, allFiles);
const annotationMissing = annotatedFamilies(defined);
const dynamicMissing = dynamicKeyFamilies(defined, allFiles);

const familyMap = new Map();
for (const d of [...expandMissing, ...annotationMissing, ...dynamicMissing]) {
    if (!familyMap.has(d.key)) { familyMap.set(d.key, d.file); }
}

if (literalMissing.length === 0 && familyMap.size === 0) {
    console.log(`verify:l10n-keys — OK (${defined.size} keys defined; all referenced t()/vt() keys resolve)`);
    process.exit(0);
}
if (literalMissing.length > 0) {
    console.error(`verify:l10n-keys — FAIL: ${literalMissing.length} referenced l10n key(s) not defined in src/l10n/strings-*.ts`);
    console.error('(t()/vt() will render these as the raw key string to the user)\n');
    for (const [key, files] of literalMissing.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  ${key}\n      referenced in: ${[...files].join(', ')}`);
    }
}
if (familyMap.size > 0) {
    console.error(`\nverify:l10n-keys — FAIL: ${familyMap.size} key family member(s) missing from catalog`);
    console.error('(@l10n-expand, @l10n-family, or t(template) expects these keys)\n');
    for (const [key, file] of [...familyMap].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  ${key}\n      in: ${file}`);
    }
}
process.exit(1);
