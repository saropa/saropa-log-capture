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

/**
 * Resolve the list of directories a clean run would remove, given root
 * and the CLI flag set. Pure — no filesystem access — so clean.test.mjs
 * can assert the always-on entries without touching disk.
 *
 * @param {string} rootDir
 * @param {Set<string>} args
 * @returns {string[]}
 */
export function buildTargets(rootDir, args) {
	// Always removed: cheap, gitignored coverage/test-run junk with no reason
	// to gate behind a flag (unlike dist/ and .vscode-test/, which are either
	// expensive to rebuild or slow to re-download).
	const targets = [
		path.join(rootDir, "out"),
		path.join(rootDir, ".nyc_output"),
		path.join(rootDir, "coverage"),
	];
	if (args.has("--dist")) {
		targets.push(path.join(rootDir, "dist"));
	}
	if (args.has("--vscode-test")) {
		targets.push(path.join(rootDir, ".vscode-test"));
	}
	return targets;
}

// Only run the destructive sweep when invoked directly (`node clean.mjs`),
// not when clean.test.mjs imports buildTargets for a pure assertion.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = new Set(process.argv.slice(2));
	for (const p of buildTargets(root, args)) {
		fs.rmSync(p, { recursive: true, force: true });
		console.log(`Removed ${path.relative(root, p) || "."}`);
	}
	console.log("clean done.");
}
