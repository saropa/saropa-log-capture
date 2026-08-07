// @ts-check
/**
 * Ensures every l10n source string whose translatable content is nothing
 * but an acronym (optionally with {n} placeholders) is registered in
 * ACRONYM_ONLY_STRINGS (l10n_brands.py).
 *
 * Without registration, such a string produces value == English in every
 * locale and shows up as an untranslated EN-COPY gap forever.
 *
 * Run: node scripts/modules/verify/verify-acronym-coverage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

// --- Extract ACRONYM_ONLY_STRINGS from the Python source ---

const brandsPath = path.join(
	root, "scripts", "modules", "verify", "l10n_brands.py",
);
const brandsSrc = fs.readFileSync(brandsPath, "utf8");

const setMatch = brandsSrc.match(
	/ACRONYM_ONLY_STRINGS[^=]*=\s*frozenset\(\{([^}]+)\}\)/s,
);
if (!setMatch) {
	console.error("ERROR: cannot parse ACRONYM_ONLY_STRINGS from l10n_brands.py");
	process.exit(1);
}
const registeredAcronyms = new Set(
	setMatch[1]
		.split(",")
		.map((s) => s.replace(/#.*/g, "").trim().replace(/^"|"$/g, ""))
		.filter(Boolean),
);

// Guard against the regex silently parsing an empty or truncated set.
if (registeredAcronyms.size < 5) {
	console.error(
		`ERROR: parsed only ${registeredAcronyms.size} acronyms from l10n_brands.py`
		+ " — the frozenset regex may be broken.",
	);
	process.exit(1);
}

// --- Scan l10n source strings ---

const l10nDir = path.join(root, "src", "l10n");
const stringFiles = fs.readdirSync(l10nDir)
	.filter((f) => f.startsWith("strings-") && f.endsWith(".ts"));

const placeholderRe = /\{[^}]*\}/g;
// 2+ uppercase ASCII letters with no lowercase — a standalone acronym.
const acronymRe = /^[A-Z]{2,}$/;

// Uppercase-styled English words that are NOT acronyms — they translate
// normally despite being all-caps in the source string (emphasis styling).
const uppercaseWordsNotAcronyms = new Set([
	"ACTIVE", "BUG", "CRITICAL", "FATAL", "OFF", "ON", "TRANSIENT",
]);

// A word in both sets means someone registered the acronym but forgot to remove
// it from the exclusion list (or vice versa). Either way the intent is ambiguous.
const overlap = [...uppercaseWordsNotAcronyms].filter((w) => registeredAcronyms.has(w));
if (overlap.length > 0) {
	console.error(
		`ERROR: ${overlap.join(", ")} appear in BOTH registeredAcronyms and`
		+ " uppercaseWordsNotAcronyms — remove from one.",
	);
	process.exit(1);
}

const failures = [];

for (const file of stringFiles) {
	const src = fs.readFileSync(path.join(l10nDir, file), "utf8");
	const entryRe = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
	let m;
	while ((m = entryRe.exec(src)) !== null) {
		const symKey = m[1];
		const enValue = m[2];
		// Strip placeholders and whitespace. If only a single acronym-shaped
		// word remains, the whole string is an acronym label.
		const stripped = enValue.replace(placeholderRe, "").trim();
		if (!acronymRe.test(stripped)) { continue; }
		if (registeredAcronyms.has(stripped)) { continue; }
		if (uppercaseWordsNotAcronyms.has(stripped)) { continue; }
		failures.push({ file, symKey, enValue, acronym: stripped });
	}
}

if (failures.length > 0) {
	console.error(
		`ERROR: ${failures.length} acronym-only source string(s) not in ACRONYM_ONLY_STRINGS.\n`,
	);
	console.error(
		"Register them in scripts/modules/verify/l10n_brands.py → ACRONYM_ONLY_STRINGS,",
	);
	console.error(
		"or reword the string so it contains translatable text alongside the acronym.\n",
	);
	for (const { file, symKey, enValue, acronym } of failures) {
		console.error(`  ${file}  ${symKey}: "${enValue}"  →  ${acronym}`);
	}
	process.exit(1);
}

const total = stringFiles.length;
console.log(
	`verify:acronym-coverage — ${registeredAcronyms.size} registered, `
	+ `${total} source files, all clear.`,
);
