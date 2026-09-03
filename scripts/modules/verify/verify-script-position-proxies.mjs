/**
 * Flags webview-script tests that assert on string *position* instead of structure —
 * `script.indexOf('...')` comparisons for branch ordering, or `.slice(i, i + N)` fixed-offset
 * windows. Both patterns silently break when a `max-lines` extraction moves the referenced
 * code to a different sibling `getXyzScript()` file or reorders concatenation, because the
 * assertion still finds *a* match but at the wrong position — this is the exact failure class
 * fixed in commits 8cbefce3 and cdf0555e (see docs/handover/20260903_0949_*.md).
 *
 * This is a one-time audit, not a correctness gate: a position-proxy assertion is not wrong by
 * itself (some are already hardened with occurrence-count guards), it is only a risk marker for
 * "re-check this test after the next max-lines extraction touches a getXyzScript() file".
 *
 * Not wired into `npm run compile` — run manually: node scripts/modules/verify/verify-script-position-proxies.mjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative to this script's own location (not process.cwd()) so the audit works the
// same whether invoked via `npm run verify:script-position-proxies` or `node <path>` from any
// directory — this file lives at <repo-root>/scripts/modules/verify/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TEST_DIR = path.join(REPO_ROOT, 'src', 'test');

/**
 * @typedef {{ file: string, line: number, kind: 'order' | 'window', text: string,
 *   suggestion?: string }} Finding
 */

/** Extract the anchor string literal from an indexOf()/lastIndexOf() call, or null. */
function anchorLiteral(line) {
    const m = line.match(/\.(?:indexOf|lastIndexOf)\(\s*(['"])(.*?)\1/);
    return m ? m[2] : null;
}

/**
 * True when varA/varB are a single-region extraction pair rather than a cross-branch ordering
 * assumption — i.e. somewhere in the file they are both used together as `.slice(varA, varB`
 * (or `varB` offset by a literal, e.g. `.slice(varA, varB + 2)`). That call is the actual
 * evidence of "these two indices bound one extracted region", so this checks the real usage
 * instead of hardcoding the `start`/`end` names the idiom happens to use today (see
 * viewer-dart-frame-format.test.ts, viewer-stack-detection-parity.test.ts) — any future pair
 * with different names but the same `.slice(a, b` shape is caught too.
 */
function isSingleRegionPair(fullText, varA, varB) {
    const sliceRe = new RegExp(`\\.slice\\(\\s*${varA}\\s*,\\s*${varB}\\b`);
    return sliceRe.test(fullText);
}

/**
 * True if a `.split(<literal>).length` occurrence-count guard for this anchor already exists
 * anywhere in the file — scanning the whole file (not just a line window around the finding)
 * because a shared guard is sometimes declared once in a `setup()`/helper and reused by several
 * assertions further down.
 */
function hasGuard(fullText, anchor) {
    if (!anchor) { return false; }
    const guardRe = new RegExp(`\\.split\\(\\s*['"\`]${escapeRegExp(anchor)}['"\`]\\s*\\)\\.length`);
    return guardRe.test(fullText);
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listTestFiles() {
    const out = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); }
            else if (entry.name.endsWith('.test.ts')) { out.push(full); }
        }
    };
    walk(TEST_DIR);
    return out;
}

/**
 * A line is an "order" risk when it compares two indexOf() results (e.g. `idxA < idxB`) to
 * assert one branch appears before another in the concatenated script — this only holds while
 * the source files concatenate in the current order. Excludes single-region extraction pairs
 * (see isSingleRegionPair) regardless of what the two variables happen to be named.
 */
function findOrderRisks(lines, file, findings) {
    const fullText = lines.join('\n');
    const idxVarRe = /\b(?:const|let)\s+(\w+)\s*=\s*\w*[Ss]cript\.(?:indexOf|lastIndexOf)\(/;
    const idxVars = new Set();
    const anchorOf = new Map();
    for (const line of lines) {
        const m = line.match(idxVarRe);
        if (m) { idxVars.add(m[1]); anchorOf.set(m[1], anchorLiteral(line)); }
    }
    if (idxVars.size < 2) { return; }
    const varAlt = [...idxVars].join('|');
    const cmpRe = new RegExp(`\\b(${varAlt})\\s*([<>]=?)\\s*(${varAlt})\\b`);
    lines.forEach((line, i) => {
        const m = line.match(cmpRe);
        if (!m) { return; }
        if (isSingleRegionPair(fullText, m[1], m[3]) || isSingleRegionPair(fullText, m[3], m[1])) { return; }
        const anchors = [anchorOf.get(m[1]), anchorOf.get(m[3])];
        const finding = { file, line: i + 1, kind: 'order', text: line.trim() };
        const unguarded = anchors.filter((a) => a && !hasGuard(fullText, a));
        if (unguarded.length > 0) {
            finding.suggestion = unguarded
                .map((a) => `assert.strictEqual(script.split(${JSON.stringify(a)}).length - 1, /* TODO: real expected count, do not assume 1 */ 'FILL_IN_COUNT', 'expected N occurrences of ${JSON.stringify(a)}');`)
                .join('\n      ');
        }
        findings.push(finding);
    });
}

/**
 * A line is a "window" risk when it slices a fixed-offset window off an indexOf() result
 * (e.g. `script.slice(i, i + 1200)`) — the window's true end drifts whenever code is added or
 * removed between the anchor and the offset boundary.
 */
function findWindowRisks(lines, file, findings) {
    const windowRe = /\.slice\(\s*\w+\s*,\s*\w+\s*\+\s*\d+\s*\)/;
    lines.forEach((line, i) => {
        if (windowRe.test(line)) {
            findings.push({ file, line: i + 1, kind: 'window', text: line.trim() });
        }
    });
}

/** @returns {Finding[]} */
function auditFile(file) {
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.split('\n');
    const relFile = path.relative(process.cwd(), file);
    /** @type {Finding[]} */
    const findings = [];
    findOrderRisks(lines, relFile, findings);
    findWindowRisks(lines, relFile, findings);
    return findings;
}

const allFindings = listTestFiles().flatMap(auditFile);

if (allFindings.length === 0) {
    console.log('verify:script-position-proxies — no position-proxy risks found in src/test/**/*.test.ts');
    process.exit(0);
}

const byFile = new Map();
for (const f of allFindings) {
    if (!byFile.has(f.file)) { byFile.set(f.file, []); }
    byFile.get(f.file).push(f);
}

console.log(
    `verify:script-position-proxies — ${allFindings.length} position-proxy assertion(s) in ${byFile.size} file(s)`
    + ' (informational — review after any max-lines extraction touching getXyzScript() files):\n',
);
for (const [file, findings] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${file}`);
    for (const f of findings.sort((a, b) => a.line - b.line)) {
        const label = f.kind === 'order' ? 'ordering-by-index' : 'fixed-offset window';
        console.log(`    L${f.line} [${label}]  ${f.text}`);
        if (f.suggestion) {
            console.log(`      suggested guard (fill in the TODO count, then add near L${f.line}):`);
            console.log(`      ${f.suggestion}`);
        }
    }
}
console.log('\nThese are not failures — they are candidates for hardening (occurrence-count guards, ');
console.log('structural assertions) the next time a getXyzScript() file is split or reordered.');
console.log('Suggested guards are advisory text only — this script never edits test files.');
process.exit(0);
