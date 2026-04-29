// @ts-check
/**
 * Removes local build / test output directories.
 * Usage: node scripts/modules/clean.mjs
 *        node scripts/modules/clean.mjs --dist
 *        node scripts/modules/clean.mjs --vscode-test
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const args = new Set(process.argv.slice(2));
const targets = [path.join(root, "out")];
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
