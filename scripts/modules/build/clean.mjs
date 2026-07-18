// @ts-check
/**
 * Removes local build / test output directories.
 * Usage: node scripts/modules/build/clean.mjs
 *        node scripts/modules/build/clean.mjs --dist
 *        node scripts/modules/build/clean.mjs --vscode-test
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

const args = new Set(process.argv.slice(2));
// Always removed: cheap, gitignored coverage/test-run junk with no reason
// to gate behind a flag (unlike dist/ and .vscode-test/, which are either
// expensive to rebuild or slow to re-download).
const targets = [
	path.join(root, "out"),
	path.join(root, ".nyc_output"),
	path.join(root, "coverage"),
];
if (args.has("--dist")) {
	targets.push(path.join(root, "dist"));
}
if (args.has("--vscode-test")) {
	targets.push(path.join(root, ".vscode-test"));
}

for (const p of targets) {
	fs.rmSync(p, { recursive: true, force: true });
	console.log(`Removed ${path.relative(root, p) || "."}`);
}
console.log("clean done.");
