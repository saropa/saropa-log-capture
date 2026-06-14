/**
 * Preloaded (via `--require`) during coverage runs of the pure `node:test`
 * suites. Those files run in a plain `node --test` process — separate from the
 * Extension Host — so the Mocha coverage hook (`coverage-hook.ts`) never sees
 * them. Without this dump, every module exercised only by node:test reports as
 * untested and drags global coverage well below the gate even though the tests
 * pass.
 *
 * `nyc instrument --in-place out` accumulates per-file hit counts into
 * `global.__coverage__` (nyc's default coverage variable). We write that to a
 * SEPARATE file in `.nyc_output` — NOT `coverage-final.json`, which the Mocha
 * hook owns — so `nyc report` merges both sources instead of one clobbering the
 * other.
 *
 * The filename embeds `process.pid` because `node --test` runs EACH test file
 * in its own child process, so this hook fires once per child. A fixed filename
 * would make every child overwrite the previous one and only the last file's
 * coverage would survive (the symptom that first shipped this hook: most pure
 * modules stayed at their pre-merge numbers). `nyc report` merges every
 * `*.json` under .nyc_output, so one file per pid is exactly what it wants.
 *
 * CommonJS + `process.on('exit')`: this is a `--require` preload, so it loads
 * before any test framework globals exist; the exit handler is the only point
 * where the full accumulated coverage is available.
 */
const fs = require('node:fs');
const path = require('node:path');

process.on('exit', () => {
	const cov = global.__coverage__;
	if (!cov) {
		return;
	}

	// __dirname is scripts/modules/test; three levels up is the repo root.
	const dir = path.resolve(__dirname, '..', '..', '..', '.nyc_output');
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, `coverage-node-${process.pid}.json`),
		JSON.stringify(cov),
	);
});
