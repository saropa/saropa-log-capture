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
 * Var-name pairs that are a known, deliberate single-region idiom, not a cross-branch ordering
 * assumption — e.g. `start = script.indexOf(anchor)` / `end = script.indexOf('\n}', start)` /
 * `assert.ok(end > start, ...)` to extract one balanced function body (see
 * viewer-dart-frame-format.test.ts, viewer-stack-detection-parity.test.ts). Comparing these two
 * is validating a single extraction window, not asserting two different branches' relative
 * order, so it is not a position-proxy risk in the sense this audit is looking for.
 */
const SINGLE_REGION_PAIR = new Set(['start,end', 'end,start']);

/**
 * @typedef {{ file: string, line: number, kind: 'order' | 'window', text: string,
 *   suggestion?: string }} Finding
 */

/** How many lines around a flagged comparison count as "nearby" when checking for an existing
 *  occurrence-count guard (`.split(anchor).length - 1 === N` — the pattern manually added to
 *  viewer-stack-frame-click.test.ts in cdf0555e) so this audit doesn't re-suggest a guard that's
 *  already there. */
const GUARD_SEARCH_WINDOW = 5;

/** Extract the anchor string literal from an indexOf()/lastIndexOf() call, or null. */
function anchorLiteral(line) {
    const m = line.match(/\.(?:indexOf|lastIndexOf)\(\s*(['"])(.*?)\1/);
    return m ? m[2] : null;
}

/** True if a `.split(<literal>).length` occurrence-count guard already exists near lineIdx. */
function hasNearbyGuard(lines, lineIdx, anchors) {
    const from = Math.max(0, lineIdx - GUARD_SEARCH_WINDOW);
    const to = Math.min(lines.length, lineIdx + GUARD_SEARCH_WINDOW + 1);
    const window = lines.slice(from, to).join('\n');
    if (!/\.split\(.*\)\.length/.test(window)) { return false; }
    return anchors.some((a) => a && window.includes(a));
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
 * the source files concatenate in the current order. Excludes the known start/end
 * single-region idiom (see SINGLE_REGION_PAIR).
 */
function findOrderRisks(lines, file, findings) {
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
        if (!m || SINGLE_REGION_PAIR.has(`${m[1]},${m[3]}`)) { return; }
        const anchors = [anchorOf.get(m[1]), anchorOf.get(m[3])];
        const finding = { file, line: i + 1, kind: 'order', text: line.trim() };
        if (!hasNearbyGuard(lines, i, anchors)) {
            finding.suggestion = anchors
                .filter(Boolean)
                .map((a) => `assert.strictEqual(script.split(${JSON.stringify(a)}).length - 1, /* TODO fill in */ 1, 'expected exactly one occurrence of ${JSON.stringify(a)}');`)
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
