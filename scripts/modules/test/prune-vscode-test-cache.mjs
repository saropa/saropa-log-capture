// @ts-check
/**
 * Prunes stale VS Code builds from `.vscode-test/`, keeping only the newest
 * version install.
 *
 * Why this exists: `@vscode/test-electron` downloads a full ~200 MB VS Code
 * build per version under `.vscode-test/vscode-<platform>-archive-<version>/`
 * and never removes the old ones. Each new VS Code release exercised by tests
 * adds another copy. Left unbounded this reached 16.3 GB / 179,824 files across
 * 26 installs, which pinned a CPU core and froze the window on open (Bug 002 /
 * Bug 003). Watcher-excluding `.vscode-test` hides it from VS Code but the disk
 * keeps growing; this prune stops the growth at the source.
 *
 * Run as the `posttest` lifecycle script so every `npm test` leaves at most one
 * install behind. The `extensions/` and `user-data/` siblings are small and
 * persistent and are never touched. Safe when `.vscode-test` is absent.
 *
 * Usage: node scripts/modules/test/prune-vscode-test-cache.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.resolve(__dirname, "..", "..", "..", ".vscode-test");
const dryRun = process.argv.slice(2).includes("--dry-run");

/**
 * Parses the trailing `X.Y.Z` from a `vscode-<platform>-archive-<version>`
 * install dir name into a comparable tuple. Returns null for names without a
 * recognizable version so they sort oldest and are never kept by accident.
 * @param {string} name
 * @returns {readonly number[] | null}
 */
function parseVersion(name) {
	const match = /(\d+)\.(\d+)\.(\d+)$/.exec(name);
	if (!match) {
		return null;
	}
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orders two installs newest-first by semantic version, falling back to
 * directory mtime when either name lacks a parseable version.
 * @param {{ name: string; version: readonly number[] | null; mtimeMs: number }} a
 * @param {{ name: string; version: readonly number[] | null; mtimeMs: number }} b
 * @returns {number}
 */
function newestFirst(a, b) {
	if (a.version && b.version) {
		for (let i = 0; i < 3; i++) {
			if (a.version[i] !== b.version[i]) {
				return b.version[i] - a.version[i];
			}
		}
		return 0;
	}
	// One side has no version — order by mtime so a malformed dir can't win.
	return b.mtimeMs - a.mtimeMs;
}

/**
 * Recursively sums the byte size of a directory tree, ignoring entries that
 * vanish mid-walk (a concurrent clean) rather than throwing.
 * @param {string} dir
 * @returns {number}
 */
function dirSize(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		try {
			total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
		} catch {
			// Entry removed during the walk — count it as zero, keep going.
		}
	}
	return total;
}

/**
 * Lists the per-version VS Code install dirs (the `vscode-…-archive-…` entries),
 * annotated with parsed version and mtime for ordering.
 * @returns {Array<{ name: string; version: readonly number[] | null; mtimeMs: number }>}
 */
function listInstalls() {
	return fs
		.readdirSync(testDir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name.startsWith("vscode-"))
		.map((e) => ({
			name: e.name,
			version: parseVersion(e.name),
			mtimeMs: fs.statSync(path.join(testDir, e.name)).mtimeMs,
		}));
}

if (!fs.existsSync(testDir)) {
	process.exit(0);
}

const installs = listInstalls().sort(newestFirst);
if (installs.length <= 1) {
	console.log(
		`prune-vscode-test-cache: ${installs.length} install present, nothing to prune.`,
	);
	process.exit(0);
}

// Keep the newest install; everything older is redundant download churn.
const [keep, ...stale] = installs;
let freed = 0;
for (const install of stale) {
	const full = path.join(testDir, install.name);
	freed += dirSize(full);
	if (!dryRun) {
		fs.rmSync(full, { recursive: true, force: true });
	}
	console.log(`${dryRun ? "would remove" : "removed"} ${install.name}`);
}

const freedGb = (freed / 1024 ** 3).toFixed(2);
console.log(
	`prune-vscode-test-cache: kept ${keep.name}, ${dryRun ? "would free" : "freed"} ${freedGb} GB across ${stale.length} stale install(s).`,
);
