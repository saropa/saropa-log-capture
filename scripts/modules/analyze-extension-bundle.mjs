// @ts-check
/**
 * One-off esbuild of src/extension.ts with metafile for bundle inspection.
 * Writes out/extension-bundle-meta.json and prints esbuild's text analysis.
 * Does not replace npm run compile (no codicon copy, no production flags).
 */
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const outDir = path.join(root, "out");
const metaPath = path.join(outDir, "extension-bundle-meta.json");

const MB = 1024 * 1024;
/** Fail CI if bundled extension exceeds this (catch accidental huge deps). */
const MAX_BYTES = 14 * MB;

async function main() {
	fs.mkdirSync(outDir, { recursive: true });
	const result = await esbuild.build({
		absWorkingDir: root,
		entryPoints: ["src/extension.ts"],
		bundle: true,
		format: "cjs",
		platform: "node",
		outfile: path.join(outDir, "extension-bundle-analyze.cjs"),
		external: ["vscode"],
		metafile: true,
		logLevel: "warning",
		minify: false,
		sourcemap: false,
	});

	fs.writeFileSync(metaPath, JSON.stringify(result.metafile, null, 2), "utf8");

	const analysis = await esbuild.analyzeMetafile(result.metafile, { verbose: true });
	console.log(analysis);

	const outputs = result.metafile.outputs;
	let total = 0;
	for (const o of Object.values(outputs)) {
		total += o.bytes ?? 0;
	}
	console.log(`\nMetafile written: ${path.relative(root, metaPath)}`);
	console.log(`Total output bytes (all chunks): ${total} (${(total / MB).toFixed(2)} MiB)`);

	const failMax = process.argv.includes("--check-size");
	if (failMax && total > MAX_BYTES) {
		console.error(`ERROR: bundle output ${total} bytes exceeds limit ${MAX_BYTES} (${MAX_BYTES / MB} MiB).`);
		process.exit(1);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
