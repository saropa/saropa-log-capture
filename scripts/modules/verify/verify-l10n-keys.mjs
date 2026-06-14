/**
 * Verify that every literal l10n key referenced via t('…') / vt('…') in src/ is defined in the
 * catalog (src/l10n/strings-*.ts). An undefined key is not a compile error — t()/vt() fall back to
 * returning the raw key, so the bug ships as a literal "namespace.key" string shown to the user.
 * This catches that statically (no running the extension needed).
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

const defined = definedKeys();
const missing = [...referencedKeys()].filter(([key]) => !defined.has(key));

if (missing.length === 0) {
    console.log(`verify:l10n-keys — OK (${defined.size} keys defined; all referenced t()/vt() keys resolve)`);
    process.exit(0);
}

console.error(`verify:l10n-keys — FAIL: ${missing.length} referenced l10n key(s) are not defined in src/l10n/strings-*.ts`);
console.error('(t()/vt() will render these as the raw key string to the user)\n');
for (const [key, files] of missing.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.error(`  ${key}\n      referenced in: ${[...files].join(', ')}`);
}
process.exit(1);
