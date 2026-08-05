/**
 * Verify that every literal l10n key referenced via t('…') / vt('…') in src/ is defined in the
 * catalog (src/l10n/strings-*.ts). An undefined key is not a compile error — t()/vt() fall back to
 * returning the raw key, so the bug ships as a literal "namespace.key" string shown to the user.
 * This catches that statically (no running the extension needed).
 *
 * Three layers:
 *  1. Literal keys: t('a.b.c') referenced in src/ — must exist in the catalog.
 *  2. Dynamic key families: t(`prefix.${var}.suffix`) patterns — every string literal in the same
 *     file that resolves at least one suffix must resolve ALL suffixes in the family.
 *  3. @l10n-family annotations: `// @l10n-family .title .label .text` in catalog files — every
 *     key group below the comment must have entries for every declared suffix.
 *
 * Scope / exclusions:
 *  - Tests (src/test/**) are skipped — they legitimately reference stub keys (fallback tests).
 *  - Dynamic keys built by concatenation (`t('viewer.level.' + x)`) surface as a literal ending in
 *    '.', and template-literal keys (`t(`a.${b}`)`) aren't matched at all; both are ignored here.
 *  - A "key" must contain a '.' (every real catalog key is namespaced) to avoid matching locals.
 *
 * Run: node scripts/modules/verify/verify-l10n-keys.mjs   (wired into `npm run compile`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve('src');
const L10N = path.join(SRC, 'l10n');

/** Recursively collect *.ts files under dir, skipping the given absolute-path prefixes. */
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

/** All keys DEFINED in the catalog (both quote styles, any indentation). */
function definedKeys() {
    const keys = new Set();
    for (const file of fs.readdirSync(L10N)) {
        if (!/^strings.*\.ts$/.test(file)) { continue; }
        const text = fs.readFileSync(path.join(L10N, file), 'utf-8');
        for (const m of text.matchAll(/['"]([a-zA-Z0-9._-]+)['"]\s*:/g)) { keys.add(m[1]); }
    }
    return keys;
}

/** Every literal t('…') / vt('…') key referenced outside tests, with the file it came from. */
function referencedKeys() {
    const refs = new Map(); // key -> Set(files)
    const skip = [path.join(SRC, 'test')];
    for (const file of collectTsFiles(SRC, skip)) {
        const text = fs.readFileSync(file, 'utf-8');
        for (const m of text.matchAll(/\b(?:t|vt)\((['"])([a-zA-Z][a-zA-Z0-9._-]+)\1/g)) {
            const key = m[2];
            // Dynamic prefixes (trailing '.') and non-namespaced locals are not real catalog keys.
            if (!key.includes('.') || key.endsWith('.')) { continue; }
            if (!refs.has(key)) { refs.set(key, new Set()); }
            refs.get(key).add(path.relative(SRC, file));
        }
    }
    return refs;
}

/**
 * Dynamic key families: functions that build t() keys from a base + fixed suffixes.
 * Pattern: t(`prefix.${param}.suffix`) — the existing literal scanner skips these.
 * Scans each file for t(template) calls sharing a common prefix, collects the set
 * of suffixes, then tests every string literal in the file as a potential base —
 * a literal qualifies when at least one prefix.literal.suffix resolves, and the
 * check fails when any suffix in the family is missing.
 */
function dynamicKeyFamilies(defined) {
    const missing = []; // { key, file }
    const skip = [path.join(SRC, 'test')];
    for (const file of collectTsFiles(SRC, skip)) {
        const text = fs.readFileSync(file, 'utf-8');
        // Match t(`prefix.${var}.suffix`) with 1+ dot-segments in prefix
        const tplPattern = /\bt\(`([a-zA-Z0-9._-]+)\.\$\{(\w+)\}\.([a-zA-Z0-9_-]+)`/g;
        // prefix -> Set<suffix>
        const families = new Map();
        for (const m of text.matchAll(tplPattern)) {
            const prefix = m[1];
            if (!families.has(prefix)) { families.set(prefix, new Set()); }
            families.get(prefix).add(m[3]);
        }
        if (families.size === 0) { continue; }
        // Only check families with 2+ suffixes (single-suffix = no family to verify)
        for (const [prefix, suffixes] of families) {
            if (suffixes.size < 2) { families.delete(prefix); }
        }
        if (families.size === 0) { continue; }
        // Collect every string literal in the file as a candidate base.
        const literals = new Set();
        for (const m of text.matchAll(/['"]([a-zA-Z][a-zA-Z0-9_-]*)[']/g)) {
            literals.add(m[1]);
        }
        for (const [prefix, suffixes] of families) {
            const suffixArr = [...suffixes];
            for (const base of literals) {
                // A base qualifies only when at least one suffix key exists.
                if (!suffixArr.some((s) => defined.has(`${prefix}.${base}.${s}`))) { continue; }
                for (const suffix of suffixArr) {
                    const key = `${prefix}.${base}.${suffix}`;
                    if (!defined.has(key)) {
                        missing.push({ key, file: path.relative(SRC, file) });
                    }
                }
            }
        }
    }
    return missing;
}

/**
 * @l10n-family annotations in catalog files. Format:
 *   // @l10n-family .title .label .text
 * Covers the contiguous block of key definitions below the comment. Scope ends
 * at the first blank line, another comment, or another @l10n-family. Every key
 * whose last dot-segment matches a declared suffix is grouped by its base; then
 * every base must have ALL declared suffixes or the check fails.
 */
function annotatedFamilies(defined) {
    const missing = []; // { key, file }
    for (const file of fs.readdirSync(L10N)) {
        if (!/^strings.*\.ts$/.test(file)) { continue; }
        const text = fs.readFileSync(path.join(L10N, file), 'utf-8');
        const lines = text.split('\n');
        let activeSuffixes = null; // string[] | null
        let bases = null; // Map<base, Set<suffix>>
        for (const line of lines) {
            const familyMatch = line.match(/\/\/\s*@l10n-family\s+(.+)/);
            if (familyMatch) {
                if (activeSuffixes && bases) {
                    flushFamily(activeSuffixes, bases, file, missing, defined);
                }
                activeSuffixes = familyMatch[1].trim().split(/\s+/).filter((s) => s.startsWith('.'));
                bases = new Map();
                continue;
            }
            if (!activeSuffixes) { continue; }
            const keyMatch = line.match(/['"]([a-zA-Z0-9._-]+)['"]\s*:/);
            if (!keyMatch) {
                // Non-key line (blank, comment, brace) terminates the family scope
                if (activeSuffixes && bases) {
                    flushFamily(activeSuffixes, bases, file, missing, defined);
                }
                activeSuffixes = null;
                bases = null;
                continue;
            }
            const fullKey = keyMatch[1];
            for (const suffix of activeSuffixes) {
                if (fullKey.endsWith(suffix)) {
                    const base = fullKey.slice(0, -suffix.length);
                    if (!bases.has(base)) { bases.set(base, new Set()); }
                    bases.get(base).add(suffix);
                    break;
                }
            }
        }
        if (activeSuffixes && bases) {
            flushFamily(activeSuffixes, bases, file, missing, defined);
        }
    }
    return missing;
}

function flushFamily(suffixes, bases, file, missing, defined) {
    for (const [base, found] of bases) {
        for (const suffix of suffixes) {
            const key = `${base}${suffix}`;
            if (!found.has(suffix) && !defined.has(key)) {
                missing.push({ key, file });
            }
        }
    }
}

// ── Main ────────────────────────────────────────────────────────────────

const defined = definedKeys();
const literalMissing = [...referencedKeys()].filter(([key]) => !defined.has(key));
const dynamicMissing = dynamicKeyFamilies(defined);
const annotationMissing = annotatedFamilies(defined);

// Deduplicate: dynamic and annotation checks may flag the same key
const allDynamic = new Map();
for (const d of [...dynamicMissing, ...annotationMissing]) {
    if (!allDynamic.has(d.key)) { allDynamic.set(d.key, d.file); }
}

if (literalMissing.length === 0 && allDynamic.size === 0) {
    console.log(`verify:l10n-keys — OK (${defined.size} keys defined; all referenced t()/vt() keys resolve)`);
    process.exit(0);
}

if (literalMissing.length > 0) {
    console.error(`verify:l10n-keys — FAIL: ${literalMissing.length} referenced l10n key(s) are not defined in src/l10n/strings-*.ts`);
    console.error('(t()/vt() will render these as the raw key string to the user)\n');
    for (const [key, files] of literalMissing.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  ${key}\n      referenced in: ${[...files].join(', ')}`);
    }
}
if (allDynamic.size > 0) {
    console.error(`\nverify:l10n-keys — FAIL: ${allDynamic.size} key family member(s) missing from catalog`);
    console.error('(a t(template) pattern or @l10n-family annotation expects these suffixes)\n');
    for (const [key, file] of [...allDynamic].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  ${key}\n      in: ${file}`);
    }
}
process.exit(1);
