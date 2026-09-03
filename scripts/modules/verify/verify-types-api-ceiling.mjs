// @ts-check
/**
 * Advisory check: detects if the INSTALLED @types/vscode version exceeds
 * the engines.vscode floor, even when package.json's range is correct.
 * This catches cases where npm resolves a newer patch/minor than the
 * floor allows at runtime — e.g. ^1.105.0 resolving to 1.110.x because
 * that's the latest matching version on the registry.
 *
 * When the installed version exceeds the engine floor, APIs introduced
 * after the floor may be available at compile time but crash at runtime
 * on older VS Code installs. This script warns about the gap so the
 * developer can verify they aren't using newer APIs.
 *
 * Advisory only — does not fail the build. The compile/package gates
 * (verify:engine-types-match) handle the hard constraint.
 *
 * Usage: node scripts/modules/verify/verify-types-api-ceiling.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

const pkg = JSON.parse(
	fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

/**
 * Extracts the floor major.minor from a semver range.
 * Strips leading operator chars (^, ~, >=, =) before matching digits.
 */
function parseFloor(range) {
	const cleaned = String(range).replace(/^[^\d]*/, "");
	const m = cleaned.match(/^(\d+)\.(\d+)/);
	if (!m) {
		return null;
	}
	return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) };
}

/**
 * Reads the installed @types/vscode version from node_modules.
 * Returns the actual resolved version, not the range from package.json.
 */
function getInstalledTypesVersion() {
	const typesPackagePath = path.join(
		root,
		"node_modules",
		"@types",
		"vscode",
		"package.json",
	);
	if (!fs.existsSync(typesPackagePath)) {
		return null;
	}
	const typesPkg = JSON.parse(fs.readFileSync(typesPackagePath, "utf8"));
	return typesPkg.version ?? null;
}

const engineRange = pkg.engines?.vscode;
if (!engineRange) {
	console.error("ERROR: package.json missing engines.vscode");
	process.exit(1);
}

const engineFloor = parseFloor(engineRange);
if (!engineFloor) {
	console.error(
		`ERROR: cannot parse engines.vscode version from "${engineRange}"`,
	);
	process.exit(1);
}

const installedVersion = getInstalledTypesVersion();
if (!installedVersion) {
	// Not installed — npm install hasn't run yet
	console.log(
		"SKIP: @types/vscode not installed (run npm install first)",
	);
	process.exit(0);
}

const installedFloor = parseFloor(installedVersion);
if (!installedFloor) {
	console.error(
		`ERROR: cannot parse installed @types/vscode version "${installedVersion}"`,
	);
	process.exit(1);
}

// Check if installed version exceeds engine floor
const exceeds =
	installedFloor.major > engineFloor.major ||
	(installedFloor.major === engineFloor.major &&
		installedFloor.minor > engineFloor.minor);

if (exceeds) {
	// Advisory warning — the installed types expose APIs newer than the engine floor
	console.warn(
		`WARNING: installed @types/vscode (${installedVersion}) is newer than ` +
			`engines.vscode floor (${engineRange}). APIs introduced between ` +
			`${engineFloor.major}.${engineFloor.minor} and ` +
			`${installedFloor.major}.${installedFloor.minor} will compile but ` +
			`may crash at runtime on VS Code ${engineFloor.major}.${engineFloor.minor}. ` +
			`Verify that src/ does not use APIs introduced after the engine floor.`,
	);
	// Exit 0 — advisory only, does not block the build
	process.exit(0);
}

console.log(
	`OK: installed @types/vscode (${installedVersion}) matches engine floor ` +
		`(${engineRange}) — no API ceiling risk`,
);
