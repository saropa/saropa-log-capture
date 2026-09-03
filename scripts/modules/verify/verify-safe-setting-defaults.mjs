// @ts-check
/**
 * Ensures destructive settings default to false in package.json.
 * Settings that delete, remove, or overwrite user files must require
 * explicit opt-in — a true default is a data-loss risk for users who
 * never visit the settings page.
 *
 * Destructive settings are identified by keyword match on the setting
 * key. Add an entry to ALLOW_TRUE if a future setting legitimately
 * needs a true default despite the keyword match.
 *
 * Usage:
 *   node scripts/modules/verify/verify-safe-setting-defaults.mjs          # check only
 *   node scripts/modules/verify/verify-safe-setting-defaults.mjs --fix    # auto-fix to false
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const pkgPath = path.join(root, "package.json");

const fixMode = process.argv.includes("--fix");

/**
 * Keywords in setting keys that indicate destructive behavior.
 * Case-insensitive, word-boundary-aware so camelCase segments like
 * "deleteOriginals" and "autoClean" still match at segment boundaries.
 * The pattern also matches at camelCase transitions (uppercase after
 * lowercase) via the lookahead/lookbehind alternatives.
 */
const DESTRUCTIVE_KEYWORDS = [
	"delete",
	"remove",
	"purge",
	"wipe",
	"discard",
	"overwrite",
	"clean",
	"erase",
	"strip",
	"truncate",
];

/**
 * Builds a regex that matches any keyword at word boundaries OR at
 * camelCase segment boundaries (e.g. "autoDelete" matches "delete").
 */
function buildKeywordPattern(keywords) {
	// Join as alternation, match case-insensitively
	const alt = keywords.join("|");
	return new RegExp(`(?:^|\\b|(?<=[a-z])(?=[A-Z]))(${alt})(?:\\b|(?=[A-Z])|$)`, "i");
}

const DESTRUCTIVE_PATTERN = buildKeywordPattern(DESTRUCTIVE_KEYWORDS);

/**
 * Allowlist for settings that match a destructive keyword but
 * legitimately default to true. Add entries here with a comment
 * explaining why the default is safe.
 */
const ALLOW_TRUE = new Set([
	// (none yet — add "saropaLogCapture.x.y" with justification)
]);

const raw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);

/**
 * Collects all setting properties from contributes.configuration.
 * Handles both the single-object form ({ properties: {...} }) and the
 * array form ([{ properties: {...} }, ...]) that VS Code supports.
 */
function collectSettings(config) {
	if (!config) {
		return {};
	}
	// Array form: merge all sections' properties
	if (Array.isArray(config)) {
		const merged = {};
		for (const section of config) {
			Object.assign(merged, section.properties ?? {});
		}
		return merged;
	}
	// Single-object form
	return config.properties ?? {};
}

const settings = collectSettings(pkg.contributes?.configuration);

const violations = [];

for (const [key, schema] of Object.entries(settings)) {
	// Only check boolean settings — enums/strings can't be "true"
	if (schema.type !== "boolean") {
		continue;
	}

	// Strip the extension prefix for keyword matching
	const shortKey = key.replace(/^saropaLogCapture\./, "");
	if (!DESTRUCTIVE_PATTERN.test(shortKey)) {
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
	if (fixMode) {
		// Fix each violation by replacing "default": true with "default": false
		// in the JSON text, scoped to the specific setting key's block
		let updated = raw;
		let fixCount = 0;

		for (const key of violations) {
			// Match the setting key followed by its "default": true within a
			// reasonable window (the setting block is typically <200 chars)
			const escapedKey = key.replace(/\./g, "\\.");
			const pattern = new RegExp(
				`("${escapedKey}"\\s*:\\s*\\{[^}]*?"default"\\s*:\\s*)true`,
			);
			if (pattern.test(updated)) {
				updated = updated.replace(pattern, "$1false");
				fixCount++;
			}
		}

		if (fixCount === 0) {
			console.error(
				"ERROR: found violations but could not auto-fix them in the JSON text. Fix manually:",
			);
			for (const key of violations) {
				console.error(`  - ${key}`);
			}
			process.exit(1);
		}

		fs.writeFileSync(pkgPath, updated, "utf8");
		console.log(
			`FIXED: changed ${fixCount} destructive setting default(s) from true to false:`,
		);
		for (const key of violations) {
			console.log(`  - ${key}`);
		}
		process.exit(0);
	}

	console.error(
		"ERROR: destructive settings must default to false (explicit opt-in):",
	);
	for (const key of violations) {
		console.error(`  - ${key}`);
	}
	console.error(
		"\nChange the default to false in package.json, add to ALLOW_TRUE " +
			"with justification, or run with --fix to auto-correct.",
	);
	process.exit(1);
}

console.log(
	"OK: all destructive settings default to false (checked " +
		`${Object.keys(settings).length} settings, ` +
		`${DESTRUCTIVE_KEYWORDS.length} keyword filter)`,
);
