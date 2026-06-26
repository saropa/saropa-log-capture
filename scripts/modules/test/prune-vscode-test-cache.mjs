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
 * The pure selection helpers are exported for unit tests; the file system
 * mutation only runs when the script is invoked directly (the `isMain` guard),
 * so importing it for a test never deletes a real cache.
 *
 * Usage: node scripts/modules/test/prune-vscode-test-cache.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} Install
 * @property {string} name Install dir name, e.g. `vscode-win32-x64-archive-1.126.0`.
 * @property {readonly number[] | null} version Parsed `[major, minor, patch]`, or null.
 * @property {number} mtimeMs Directory mtime, the tie-breaker when version is null.
 */

/**
 * Parses the trailing `X.Y.Z` from a `vscode-<platform>-archive-<version>`
 * install dir name into a comparable tuple. Returns null for names without a
 * recognizable version so they sort oldest and are never kept by accident.
 * @param {string} name
 * @returns {readonly number[] | null}
 */
export function parseVersion(name) {
	const match = /(\d+)\.(\d+)\.(\d+)$/.exec(name);
	if (!match) {
		return null;
	}
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orders two installs newest-first by semantic version, falling back to
 * directory mtime when either name lacks a parseable version.
 * @param {Install} a
 * @param {Install} b
 * @returns {number}
 */
export function compareNewestFirst(a, b) {
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
 * Pure selection: given the install descriptors, returns the single newest to
 * keep and the rest to remove. `keep` is null only when the list is empty.
 * @param {readonly Install[]} installs
 * @returns {{ keep: Install | null; stale: Install[] }}
 */
export function selectStaleInstalls(installs) {
	const sorted = [...installs].sort(compareNewestFirst);
	const [keep = null, ...stale] = sorted;
	return { keep, stale };
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
 * Lists the per-version VS Code install dirs (the `vscode-…-archive-…` entries)
 * under `testDir`, annotated with parsed version and mtime for ordering.
 * @param {string} testDir
 * @returns {Install[]}
 */
function listInstalls(testDir) {
	return fs
		.readdirSync(testDir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name.startsWith("vscode-"))
		.map((e) => ({
			name: e.name,
			version: parseVersion(e.name),
			mtimeMs: fs.statSync(path.join(testDir, e.name)).mtimeMs,
		}));
}

/**
 * Removes every install but the newest under `testDir`, printing what it kept
 * and freed. No-op when the dir is absent or holds at most one install.
 * @param {string} testDir
 * @param {boolean} dryRun
 * @returns {void}
 */
function prune(testDir, dryRun) {
	if (!fs.existsSync(testDir)) {
		return;
	}
	const { keep, stale } = selectStaleInstalls(listInstalls(testDir));
	if (!keep || stale.length === 0) {
		console.log(
			`prune-vscode-test-cache: ${keep ? 1 : 0} install present, nothing to prune.`,
		);
		return;
	}
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
}

// Only mutate the file system when run as a script, never on import (tests
// import the pure helpers above and must not touch the real cache).
const isMain =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const root = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		"..",
		"..",
	);
	prune(path.join(root, ".vscode-test"), process.argv.slice(2).includes("--dry-run"));
}
