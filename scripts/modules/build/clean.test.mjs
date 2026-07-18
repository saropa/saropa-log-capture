// @ts-check
/**
 * Guards clean.mjs's target list — a prior version omitted .nyc_output/ and
 * coverage/, letting gitignored coverage junk accumulate across publish runs
 * with nothing to catch a future regression. Pure assertions only; no
 * filesystem access, since buildTargets() just resolves paths.
 *
 * Run: node --test scripts/modules/build/clean.test.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTargets } from "./clean.mjs";

const root = "/fake/root";

test("default run always includes out/, .nyc_output/, and coverage/", () => {
	const targets = buildTargets(root, new Set());
	assert.ok(targets.some((t) => t.endsWith("out")));
	assert.ok(targets.some((t) => t.endsWith(".nyc_output")));
	assert.ok(targets.some((t) => t.endsWith("coverage")));
});

test("dist/ is omitted unless --dist is passed", () => {
	assert.ok(!buildTargets(root, new Set()).some((t) => t.endsWith("dist")));
	assert.ok(buildTargets(root, new Set(["--dist"])).some((t) => t.endsWith("dist")));
});

test(".vscode-test/ is omitted unless --vscode-test is passed", () => {
	assert.ok(!buildTargets(root, new Set()).some((t) => t.endsWith(".vscode-test")));
	assert.ok(
		buildTargets(root, new Set(["--vscode-test"])).some((t) => t.endsWith(".vscode-test")),
	);
});
