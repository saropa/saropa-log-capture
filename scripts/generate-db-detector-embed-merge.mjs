/**
 * Compiles `db-detector-merge-stable-key.ts` to browser-safe JS and writes
 * `src/ui/viewer/generated/db-detector-embed-merge.generated.ts` for embedding in the webview.
 * Run from repo root: `npm run generate:db-detector-embed-merge`
 */
import * as esbuild from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, "src/modules/db/db-detector-merge-stable-key.ts")],
  bundle: true,
  format: "esm",
  legalComments: "none",
  platform: "neutral",
  target: "es2015",
  write: false,
  minify: false,
});

let code = result.outputFiles[0].text.trim();
// Esbuild may prefix a // path comment.
code = code.replace(/^\/\/[^\n]+\n/, "").trim();
// Drop ESM export of the merge function (implementation is the only runtime value).
code = code.replace(/\nexport\s*\{[^}]*mergeDbDetectorResultsByStableKey[^}]*\}\s*;?\s*$/m, "").trim();
code = code.replace(/\nexport\s*\{[^}]+\}\s*;?\s*$/s, "").trim();

if (!code.includes("function mergeDbDetectorResultsByStableKey")) {
  throw new Error(`Unexpected esbuild output (no merge function):\n${code.slice(0, 400)}`);
}

const outDir = join(root, "src/ui/viewer/generated");
mkdirSync(outDir, { recursive: true });
const outTs = join(outDir, "db-detector-embed-merge.generated.ts");

const ts = `/**
 * AUTO-GENERATED — do not edit. Run \`npm run generate:db-detector-embed-merge\`.
 * Source: src/modules/db/db-detector-merge-stable-key.ts
 */
export const EMBED_MERGE_DB_DETECTOR_RESULTS_JS = ${JSON.stringify(`${code}\n`)};
`;

writeFileSync(outTs, ts, "utf8");
console.log("Wrote", outTs);
