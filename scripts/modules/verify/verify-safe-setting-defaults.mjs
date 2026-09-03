// @ts-check
/**
 * Ensures destructive settings default to false in package.json.
 * Settings that delete, remove, or overwrite user files must require
 * explicit opt-in — a true default is a data-loss risk for users who
 * never visit the settings page.
 *
 * Destructive settings are identified by keyword match on the setting
 * key (delete, remove, purge, wipe, discard, overwrite, clean).
 * Add an entry to ALLOW_TRUE if a future setting legitimately needs
 * a true default despite the keyword match.
 *
 * Usage:
 *   node scripts/modules/verify/verify-safe-setting-defaults.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const pkgPath = path.join(root, "package.json");

/** Keywords in setting keys that indicate destructive behavior. */
const DESTRUCTIVE_KEYWORDS =
	/\b(delete|remove|purge|wipe|discard|overwrite|clean)\b/i;

/**
 * Allowlist for settings that match a destructive keyword but
 * legitimately default to true. Add entries here with a comment
 * explaining why the default is safe.
 */
const ALLOW_TRUE = new Set([
	// (none yet)
]);

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const settings = pkg.contributes?.configuration?.properties ?? {};

const violations = [];

for (const [key, schema] of Object.entries(settings)) {
	// Only check boolean settings — enums/strings can't be "true"
	if (schema.type !== "boolean") {
		continue;
	}

	// Only flag settings whose key contains a destructive keyword
	const shortKey = key.replace(/^saropaLogCapture\./, "");
	if (!DESTRUCTIVE_KEYWORDS.test(shortKey)) {
		continue;
	}

	// Allowlisted settings skip the check
	if (ALLOW_TRUE.has(key)) {
		continue;
	}

	if (schema.default === true) {
		violations.push(key);
	}
}

if (violations.length > 0) {
	console.error(
		"ERROR: destructive settings must default to false (explicit opt-in):",
	);
	for (const key of violations) {
		console.error(`  - ${key}`);
	}
	console.error(
		"\nChange the default to false in package.json, or add to ALLOW_TRUE with justification.",
	);
	process.exit(1);
}

console.log(
	"OK: all destructive settings default to false (checked " +
		`${Object.keys(settings).length} settings, ` +
		`${DESTRUCTIVE_KEYWORDS.source} keyword filter)`,
);
