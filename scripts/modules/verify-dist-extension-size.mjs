// @ts-check
/**
 * Guardrail: dist/extension.js must stay below a generous ceiling (dev build is unminified).
 * Run after `npm run compile`. Tighten the limit if the bundle grows unexpectedly.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const distJs = path.join(root, "dist", "extension.js");

const MB = 1024 * 1024;
const MAX_BYTES = 12 * MB;

if (!fs.existsSync(distJs)) {
	console.error("ERROR: dist/extension.js not found. Run npm run compile first.");
	process.exit(1);
}

const n = fs.statSync(distJs).size;
if (n > MAX_BYTES) {
	console.error(`ERROR: dist/extension.js is ${n} bytes (max ${MAX_BYTES}).`);
	process.exit(1);
}

console.log(`OK: dist/extension.js is ${n} bytes (${(n / MB).toFixed(2)} MiB, max ${MAX_BYTES / MB} MiB).`);
