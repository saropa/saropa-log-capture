// @ts-check
/**
 * Ensures .nvmrc, .node-version, and package.json engines.node agree on the major Node version.
 * Run in CI or locally: node scripts/modules/verify-node-toolchain.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

/** @param {string} rel */
function firstNonEmptyLine(rel) {
	const p = path.join(root, rel);
	if (!fs.existsSync(p)) {
		console.error(`ERROR: missing ${rel}`);
		process.exit(1);
	}
	const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
	for (const line of lines) {
		const t = line.trim();
		if (t && !t.startsWith("#")) {
			return t;
		}
	}
	console.error(`ERROR: ${rel} has no version line`);
	process.exit(1);
}

const nvm = firstNonEmptyLine(".nvmrc");
const nodeFile = firstNonEmptyLine(".node-version");
if (nvm !== nodeFile) {
	console.error(`ERROR: .nvmrc (${nvm}) and .node-version (${nodeFile}) must match.`);
	process.exit(1);
}

const major = parseInt(String(nvm).split(".")[0] ?? "", 10);
if (Number.isNaN(major) || major < 1) {
	console.error(`ERROR: could not parse major version from .nvmrc (${nvm})`);
	process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const range = String(pkg.engines?.node ?? "").trim();
if (!range) {
	console.error('ERROR: package.json missing engines.node');
	process.exit(1);
}

/** engines.node is ">=22.0.0" in this repo — require that major matches .nvmrc. */
const ge = range.match(/>=\s*(\d+)/);
if (ge) {
	const minMajor = parseInt(ge[1], 10);
	if (major < minMajor) {
		console.error(`ERROR: .nvmrc major ${major} is below engines.node minimum major ${minMajor} (${range})`);
		process.exit(1);
	}
}

console.log(`OK: Node toolchain aligned (.nvmrc / .node-version = ${nvm}, engines.node = ${range})`);
