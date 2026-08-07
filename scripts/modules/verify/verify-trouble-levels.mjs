// @ts-check
/**
 * Ensures the package.json troubleMode.levels enum and default match
 * the source of truth in trouble-level-constants.ts.
 *
 * Run: node scripts/modules/verify/verify-trouble-levels.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Walk contributes.configuration to find the setting, handling both
// flat `properties` and an `allOf`/`oneOf` wrapping array.
function findSetting(config) {
	if (!config) { return undefined; }
	if (config.properties?.["saropaLogCapture.troubleMode.levels"]) {
		return config.properties["saropaLogCapture.troubleMode.levels"];
	}
	for (const key of ["allOf", "oneOf"]) {
		if (Array.isArray(config[key])) {
			for (const entry of config[key]) {
				const found = findSetting(entry);
				if (found) { return found; }
			}
		}
	}
	return undefined;
}

const setting = findSetting(pkg.contributes?.configuration);
if (!setting) {
	console.error("ERROR: saropaLogCapture.troubleMode.levels not found in package.json");
	process.exit(1);
}

const pkgEnum = setting.items?.enum;
const pkgDefault = setting.default;

const tsFile = fs.readFileSync(
	path.join(root, "src", "modules", "config", "trouble-level-constants.ts"),
	"utf8",
);

/**
 * Extract a string array from an `export const NAME = [...]` declaration.
 * Handles multiline arrays and inline/trailing comments.
 * @param {string} src
 * @param {string} name
 */
function extractArray(src, name) {
	// Match from `export const NAME = [` through the closing `]`, across lines.
	const re = new RegExp(
		`export\\s+const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`,
	);
	const m = src.match(re);
	if (!m) {
		console.error(`ERROR: could not parse ${name} from trouble-level-constants.ts`);
		process.exit(1);
	}
	// Strip comments, then split on commas, then extract quoted strings.
	const body = m[1]
		.replace(/\/\/.*$/gm, "")
		.replace(/\/\*[\s\S]*?\*\//g, "");
	return body
		.split(",")
		.map((s) => {
			const q = s.trim().match(/^["'](.+)["']/);
			return q ? q[1] : "";
		})
		.filter(Boolean);
}

const tsValid = extractArray(tsFile, "troubleValidLevels");
const tsDefault = extractArray(tsFile, "troubleDefaultLevels");

let ok = true;

if (JSON.stringify(pkgEnum) !== JSON.stringify(tsValid)) {
	console.error(
		`ERROR: package.json enum ${JSON.stringify(pkgEnum)} !== troubleValidLevels ${JSON.stringify(tsValid)}`,
	);
	ok = false;
}

if (JSON.stringify(pkgDefault) !== JSON.stringify(tsDefault)) {
	console.error(
		`ERROR: package.json default ${JSON.stringify(pkgDefault)} !== troubleDefaultLevels ${JSON.stringify(tsDefault)}`,
	);
	ok = false;
}

// Verify that every valid level has a matching l10n legend key in strings-webview.ts.
// A missing key would render a raw key string in the chart legend instead of a label.
const l10nFile = fs.readFileSync(
	path.join(root, "src", "l10n", "strings-webview.ts"),
	"utf8",
);
const missingL10n = tsValid.filter(
	(lvl) => !l10nFile.includes(`'viewer.troubleChart.legend.${lvl}'`),
);
if (missingL10n.length > 0) {
	console.error(
		`ERROR: missing l10n legend keys in strings-webview.ts for: ${missingL10n.join(", ")}`,
	);
	ok = false;
}

if (!ok) {
	process.exit(1);
}

console.log(
	`verify:trouble-levels — OK (${tsValid.length} valid, ${tsDefault.length} default, ${tsValid.length} legend keys)`,
);
