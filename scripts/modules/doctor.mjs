// @ts-check
/**
 * Quick environment sanity check for contributors (Node version, build outputs).
 * Usage: node scripts/modules/doctor.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

let failed = false;
function ok(msg) {
	console.log(`OK  ${msg}`);
}
function bad(msg) {
	console.error(`ERR ${msg}`);
	failed = true;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const wantNode = pkg.engines?.node;
const major = Number(process.versions.node.split(".")[0] ?? 0);
if (wantNode && !semverSatisfies(major, wantNode)) {
	bad(`Node ${process.version} may not satisfy engines.node (${wantNode}). Use .nvmrc / .node-version.`);
} else {
	ok(`Node ${process.version}${wantNode ? ` (engines.node ${wantNode})` : ""}`);
}

if (!fs.existsSync(path.join(root, "node_modules"))) {
	bad("node_modules missing — run npm ci");
} else {
	ok("node_modules present");
}

for (const p of ["dist/extension.js"]) {
	const abs = path.join(root, p);
	if (fs.existsSync(abs)) {
		ok(`${p} exists (${fs.statSync(abs).size} bytes)`);
	} else {
		bad(`${p} missing — run npm run compile`);
	}
}

if (failed) {
	process.exit(1);
}
console.log("\nDoctor finished.");

/** Very small check: engines like ">=22.0.0" */
function semverSatisfies(major, range) {
	const m = String(range).match(/>=\s*(\d+)/);
	if (m) {
		return major >= Number(m[1]);
	}
	return true;
}
