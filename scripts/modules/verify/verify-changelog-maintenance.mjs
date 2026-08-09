// @ts-check
/**
 * Flags CHANGELOG.md bullets that read as internal/non-user-facing (l10n
 * pipeline tooling, design-token migrations, compile gates, file splits,
 * internal refactors) but sit outside a <details><summary>Maintenance</summary>
 * block. Heuristic keyword match — false positives are expected; this is an
 * advisory check, not a hard gate, and is not wired into `npm run compile`.
 *
 * Run: node scripts/modules/verify/verify-changelog-maintenance.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const changelogPath = path.join(root, "CHANGELOG.md");

// Signals that a bullet is describing internal tooling/refactoring rather
// than user-observable behavior.
const INTERNAL_PATTERNS = [
	/\bcompile gate\b/i,
	/\bl10n pipeline\b/i,
	/\bdesign token/i,
	/\bmigrated hardcoded\b/i,
	/\bconsolidated\b/i,
	/^Internal:/i,
	/\bextracted to `[^`]+\.(ts|mjs|py)`/i,
	/\bsplit into its own module\b/i,
	/\bbrought .* under the .*(line limit|300-line)/i,
	/\bsingle source of truth\b/i,
	/\bcompile-gate\b/i,
	/\bbuild gate\b/i,
	/\bverify:[a-z-]+/i,
	/test failures? caused by/i,
];

const text = fs.readFileSync(changelogPath, "utf8");
const lines = text.split("\n");

let currentVersion = "(preamble)";
let inDetails = false;
/** @type {{version: string, line: number, text: string}[]} */
const offenders = [];

for (let i = 0; i < lines.length; i++) {
	const line = lines[i];

	const versionMatch = line.match(/^## \[([^\]]+)\]/);
	if (versionMatch) {
		currentVersion = versionMatch[1];
		inDetails = false;
		continue;
	}

	if (/^<details>/.test(line)) {
		inDetails = true;
		continue;
	}
	if (/^<\/details>/.test(line)) {
		inDetails = false;
		continue;
	}

	if (inDetails) {
		continue;
	}

	if (!/^- /.test(line)) {
		continue;
	}

	if (INTERNAL_PATTERNS.some((re) => re.test(line))) {
		offenders.push({ version: currentVersion, line: i + 1, text: line.trim() });
	}
}

if (offenders.length === 0) {
	console.log("verify:changelog-maintenance — OK (no internal-sounding bullets outside a Maintenance block)");
	process.exit(0);
}

console.warn(`verify:changelog-maintenance — ${offenders.length} bullet(s) look internal but sit outside a Maintenance block:\n`);
for (const o of offenders) {
	console.warn(`  [${o.version}] CHANGELOG.md:${o.line}`);
	console.warn(`    ${o.text}\n`);
}
console.warn("Advisory only (heuristic keyword match, expect false positives) — not wired into `npm run compile`.");
