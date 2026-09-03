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

const TEST_UI_DIR = path.resolve('src', 'test', 'ui');

/** @typedef {{ file: string, line: number, kind: 'order' | 'window', text: string }} Finding */

function listTestFiles() {
    return fs.readdirSync(TEST_UI_DIR)
        .filter((f) => f.endsWith('.test.ts'))
        .map((f) => path.join(TEST_UI_DIR, f));
}

/**
 * A line is an "order" risk when it compares two indexOf() results (e.g. `idxA < idxB`) to
 * assert one branch appears before another in the concatenated script — this only holds while
 * the source files concatenate in the current order.
 */
function findOrderRisks(lines, file, findings) {
    const idxVarRe = /\bconst\s+(\w+)\s*=\s*script\.(?:indexOf|lastIndexOf)\(/;
    const idxVars = new Set();
    for (const line of lines) {
        const m = line.match(idxVarRe);
        if (m) { idxVars.add(m[1]); }
    }
    if (idxVars.size < 2) { return; }
    const varAlt = [...idxVars].join('|');
    const cmpRe = new RegExp(`\\b(${varAlt})\\s*[<>]=?\\s*(${varAlt})\\b`);
    lines.forEach((line, i) => {
        if (cmpRe.test(line)) {
            findings.push({ file, line: i + 1, kind: 'order', text: line.trim() });
        }
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
    console.log('verify:script-position-proxies — no position-proxy risks found in src/test/ui/*.test.ts');
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
    }
}
console.log('\nThese are not failures — they are candidates for hardening (occurrence-count guards, ');
console.log('structural assertions) the next time a getXyzScript() file is split or reordered.');
process.exit(0);
