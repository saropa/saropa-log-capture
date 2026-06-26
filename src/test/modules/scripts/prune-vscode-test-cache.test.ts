/**
 * Before: `@vscode/test-electron` accumulated one full VS Code build per
 * release under `.vscode-test/` with no cleanup (16.3 GB / 26 installs froze the
 * window on open — Bug 002 / Bug 003).
 * After: `scripts/modules/test/prune-vscode-test-cache.mjs` keeps only the
 * newest install. These tests pin the pure selection logic: version parsing and
 * the newest-first ordering that decides which single install survives.
 *
 * The module is imported dynamically (it is an `.mjs` outside the TS rootDir)
 * inside each test; importing it never touches the real cache because the file
 * system mutation is gated behind its `isMain` script guard.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
	path.resolve(
		__dirname,
		"..",
		"..",
		"..",
		"..",
		"scripts",
		"modules",
		"test",
		"prune-vscode-test-cache.mjs",
	),
).href;

test("parseVersion extracts the trailing X.Y.Z tuple", async () => {
	const { parseVersion } = await import(moduleUrl);
	assert.deepEqual(parseVersion("vscode-win32-x64-archive-1.126.0"), [1, 126, 0]);
	assert.deepEqual(parseVersion("vscode-darwin-arm64-archive-1.99.3"), [1, 99, 3]);
});

test("parseVersion returns null for names without a version", async () => {
	const { parseVersion } = await import(moduleUrl);
	// A null version must sort oldest so a malformed dir is never kept by accident.
	assert.equal(parseVersion("extensions"), null);
	assert.equal(parseVersion("user-data"), null);
});

test("selectStaleInstalls keeps the highest version, stales the rest", async () => {
	const { selectStaleInstalls } = await import(moduleUrl);
	const installs = [
		{ name: "vscode-win32-x64-archive-1.99.0", version: [1, 99, 0], mtimeMs: 300 },
		{ name: "vscode-win32-x64-archive-1.126.0", version: [1, 126, 0], mtimeMs: 100 },
		{ name: "vscode-win32-x64-archive-1.105.0", version: [1, 105, 0], mtimeMs: 200 },
	];
	const { keep, stale } = selectStaleInstalls(installs);
	// Version wins over mtime: 1.126.0 is kept even though it has the oldest mtime.
	assert.equal(keep.name, "vscode-win32-x64-archive-1.126.0");
	assert.deepEqual(
		stale.map((s: { name: string }) => s.name).sort(),
		["vscode-win32-x64-archive-1.105.0", "vscode-win32-x64-archive-1.99.0"],
	);
});

test("selectStaleInstalls compares versions component-wise, not lexically", async () => {
	const { selectStaleInstalls } = await import(moduleUrl);
	const installs = [
		{ name: "a-9.0.0", version: [9, 0, 0], mtimeMs: 1 },
		{ name: "b-10.0.0", version: [10, 0, 0], mtimeMs: 1 },
	];
	// String order would rank "9" above "10"; numeric tuple order must not.
	assert.equal(selectStaleInstalls(installs).keep.name, "b-10.0.0");
});

test("selectStaleInstalls falls back to mtime when a version is missing", async () => {
	const { selectStaleInstalls } = await import(moduleUrl);
	const installs = [
		{ name: "old", version: null, mtimeMs: 100 },
		{ name: "new", version: null, mtimeMs: 200 },
	];
	assert.equal(selectStaleInstalls(installs).keep.name, "new");
});

test("selectStaleInstalls returns no keep for an empty list", async () => {
	const { selectStaleInstalls } = await import(moduleUrl);
	const { keep, stale } = selectStaleInstalls([]);
	assert.equal(keep, null);
	assert.deepEqual(stale, []);
});

test("selectStaleInstalls has no stale when one install is present", async () => {
	const { selectStaleInstalls } = await import(moduleUrl);
	const installs = [{ name: "only-1.0.0", version: [1, 0, 0], mtimeMs: 1 }];
	const { keep, stale } = selectStaleInstalls(installs);
	assert.equal(keep.name, "only-1.0.0");
	assert.deepEqual(stale, []);
});
