// @ts-check
/**
 * Guard: no leftover "Saropa Log Capture" / "saropaLogCapture"
 * outside an explicit allowlist. Catches accidental regressions after the v9.8.0 rename.
 *
 * Exit 0 = clean, exit 1 = violations found.
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

/** Patterns that should no longer appear outside the allowlist. */
const OLD_PATTERNS = [
	"Saropa Log Capture",
	"saropaLogCapture",
	// The extension ID saropa.saropa-log-capture is intentionally NOT guarded: it is the live
	// marketplace ID (see src/extension-id.ts), not a leftover of the rename.
];

/**
 * Allowlisted relative paths and prefixes — files that legitimately reference
 * the old name (historical records, migration code, brand-token definitions).
 */
const ALLOWED = [
	"CHANGELOG.md",
	"CHANGELOG_ARCHIVE.md",
	"plans/125_plan-rename-to-saropa-capture.md",
	"plans/deferred/126_plan-saropa-capture-online-rename.md",
	"plans/history/",
	"docs/handover/",
	"src/legacy-compat.ts",
	"src/test/legacy-compat.test.ts",
	"src/extension-activation.ts",
	"src/l10n/strings-a.ts",
	"l10n/bundle.l10n.json",
	"scripts/modules/verify/l10n_brands.py",
	"scripts/modules/verify/test_l10n_brands.py",
	// This script itself references the patterns in string literals.
	"scripts/modules/verify/verify-no-old-name.mjs",
	// NLS files: displayName reverted to "Saropa Log Capture" while Marketplace
	// reserves the "Saropa Capture" name from the unpublished duplicate listing.
	"package.nls.json",
	"package.nls.de.json",
	"package.nls.es.json",
	"package.nls.fr.json",
	"package.nls.it.json",
	"package.nls.ja.json",
	"package.nls.ko.json",
	"package.nls.pt-br.json",
	"package.nls.ru.json",
	"package.nls.zh-cn.json",
	"package.nls.zh-tw.json",
	"bugs/",
];

/**
 * Returns true if `relPath` is covered by the allowlist.
 * Exact matches and prefix matches (for directories) are both checked.
 */
function isAllowed(relPath) {
	const normalised = relPath.replace(/\\/g, "/");
	return ALLOWED.some(
		(entry) =>
			normalised === entry ||
			(entry.endsWith("/") && normalised.startsWith(entry)),
	);
}

/** Run ripgrep (or git grep) for a fixed-string pattern and return matching file paths. */
function grepFiles(pattern) {
	try {
		// git grep returns paths relative to repo root, honours .gitignore.
		const stdout = execSync(
			`git grep -l --fixed-strings "${pattern}"`,
			{ cwd: root, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
		);
		return stdout.trim().split("\n").filter(Boolean);
	} catch {
		// Exit code 1 = no matches — that's fine.
		return [];
	}
}

let violations = 0;

for (const pattern of OLD_PATTERNS) {
	const files = grepFiles(pattern);
	for (const file of files) {
		if (!isAllowed(file)) {
			console.error(`VIOLATION: "${pattern}" found in ${file}`);
			violations++;
		}
	}
}

if (violations > 0) {
	console.error(
		`\nERROR: ${violations} old-name violation(s). ` +
		`Update the file or add it to the allowlist in verify-no-old-name.mjs.`,
	);
	process.exit(1);
}

console.log("OK: no old-name strings outside allowlist.");
