// @ts-check
/**
 * Ensures @types/vscode does not exceed engines.vscode.
 * vsce refuses to package when the types version is newer than the engine
 * floor, but only checks at the VSIX step — after version bumps and changelog
 * stamps have already been written. This gate catches the mismatch early.
 *
 * Usage:
 *   node scripts/modules/verify/verify-engine-types-match.mjs          # check only
 *   node scripts/modules/verify/verify-engine-types-match.mjs --fix    # auto-fix package.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const pkgPath = path.join(root, "package.json");

const fixMode = process.argv.includes("--fix");

const raw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);

/**
 * Extracts the floor major.minor from a semver range.
 * Handles caret (^1.105.0), tilde (~1.105.0), exact (1.105.0),
 * and >= ranges (>=1.105.0). Strips the range operator prefix before
 * matching digits, so "^1.105.0" and ">=1.105.0 <2.0.0" both yield
 * { major: 1, minor: 105 }. Does not handle || union ranges — those
 * are not used in VS Code engine declarations.
 */
function parseFloor(range) {
	// Strip leading operator chars (^, ~, >=, =) to get to the version digits
	const cleaned = String(range).replace(/^[^\d]*/, "");
	const m = cleaned.match(/^(\d+)\.(\d+)/);
	if (!m) {
		return null;
	}
	return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) };
}

const engineRange = pkg.engines?.vscode;
if (!engineRange) {
	console.error("ERROR: package.json missing engines.vscode");
	process.exit(1);
}

const typesRange = pkg.devDependencies?.["@types/vscode"];
if (!typesRange) {
	// No @types/vscode at all — nothing to check
	console.log("OK: no @types/vscode dependency — nothing to verify");
	process.exit(0);
}

const engineFloor = parseFloor(engineRange);
const typesFloor = parseFloor(typesRange);

if (!engineFloor) {
	console.error(
		`ERROR: cannot parse engines.vscode version from "${engineRange}"`,
	);
	process.exit(1);
}

if (!typesFloor) {
	console.error(
		`ERROR: cannot parse @types/vscode version from "${typesRange}"`,
	);
	process.exit(1);
}

// Types floor must not exceed engine floor (major.minor comparison)
const typesExceeds =
	typesFloor.major > engineFloor.major ||
	(typesFloor.major === engineFloor.major &&
		typesFloor.minor > engineFloor.minor);

if (typesExceeds) {
	if (fixMode) {
		// Build the corrected range using the engine floor with a caret prefix
		const corrected = `^${engineFloor.major}.${engineFloor.minor}.0`;
		const pattern = /"@types\/vscode"\s*:\s*"[^"]+"/g;
		const matches = raw.match(pattern);
		// Guard: exactly one occurrence expected (devDependencies entry)
		if (!matches || matches.length !== 1) {
			console.error(
				`ERROR: expected exactly 1 "@types/vscode" entry in package.json, ` +
					`found ${matches ? matches.length : 0}. Fix manually.`,
			);
			process.exit(1);
		}
		const updated = raw.replace(
			pattern,
			`"@types/vscode": "${corrected}"`,
		);
		fs.writeFileSync(pkgPath, updated, "utf8");
		console.log(
			`FIXED: @types/vscode changed from "${typesRange}" to "${corrected}" ` +
				`to match engines.vscode (${engineRange}). Run npm install to update the lockfile.`,
		);
		process.exit(0);
	}

	console.error(
		`ERROR: @types/vscode (${typesRange}) exceeds engines.vscode (${engineRange}). ` +
			`vsce will refuse to package this. ` +
			`Run with --fix to auto-correct, or manually lower @types/vscode to match the engine floor.`,
	);
	process.exit(1);
}

console.log(
	`OK: @types/vscode (${typesRange}) does not exceed engines.vscode (${engineRange})`,
);
