// @ts-check
/**
 * Ensures @types/vscode does not exceed engines.vscode.
 * vsce refuses to package when the types version is newer than the engine
 * floor, but only checks at the VSIX step — after version bumps and changelog
 * stamps have already been written. This gate catches the mismatch early.
 * Run in CI or locally: node scripts/modules/verify/verify-engine-types-match.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

const pkg = JSON.parse(
	fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

/** Extracts the floor major.minor from a semver range like "^1.105.0". */
function parseFloor(range) {
	const m = String(range).match(/(\d+)\.(\d+)/);
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
	console.error(
		`ERROR: @types/vscode (${typesRange}) exceeds engines.vscode (${engineRange}). ` +
			`vsce will refuse to package this. ` +
			`Lower @types/vscode to match the engine floor, or raise engines.vscode.`,
	);
	process.exit(1);
}

console.log(
	`OK: @types/vscode (${typesRange}) does not exceed engines.vscode (${engineRange})`,
);
