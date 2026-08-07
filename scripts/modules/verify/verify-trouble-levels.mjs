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
const setting = pkg.contributes?.configuration?.properties?.["saropaLogCapture.troubleMode.levels"];
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

/** @param {string} src @param {string} name */
function extractArray(src, name) {
	const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([^\\]]+)\\]`);
	const m = src.match(re);
	if (!m) {
		console.error(`ERROR: could not parse ${name} from trouble-level-constants.ts`);
		process.exit(1);
	}
	return m[1]
		.split(",")
		.map((s) => s.trim().replace(/^["']|["']$/g, ""))
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

if (!ok) {
	process.exit(1);
}

console.log(
	`verify:trouble-levels — OK (${tsValid.length} valid, ${tsDefault.length} default)`,
);
