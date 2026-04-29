// @ts-check
/**
 * Run a single compiled test file under the Extension Host (same stack as npm test).
 * Usage: npm run test:file -- out/test/ui/viewer-toolbar.test.js
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const rel = process.argv[2];
if (!rel) {
	console.error("Usage: npm run test:file -- out/test/ui/example.test.js");
	process.exit(1);
}
const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
if (!fs.existsSync(abs)) {
	console.error(`ERROR: file not found: ${abs}`);
	process.exit(1);
}
const relPosix = path.relative(root, abs).replace(/\\/g, "/");

const patch = spawnSync(process.execPath, ["scripts/modules/patch-vscode-test.js"], { cwd: root, stdio: "inherit" });
if (patch.status !== 0) {
	process.exit(patch.status ?? 1);
}

const r = spawnSync("npx", ["vscode-test", "--run", relPosix], { cwd: root, stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
