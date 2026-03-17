/**
 * Orchestrates test coverage collection for the VS Code extension.
 *
 * c8 cannot collect V8 coverage from the Extension Host (separate
 * Electron process), so we use Istanbul instrumentation via nyc:
 *
 * 1. Instrument compiled `out/` in-place
 * 2. Run tests — instrumented code populates `global.__coverage__`
 * 3. Coverage hook (coverage-hook.ts) writes data to `.nyc_output/`
 * 4. Restore un-instrumented files via recompilation
 * 5. Generate coverage report and check thresholds
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const nycOutput = path.join(root, '.nyc_output');

// Clean previous coverage data
if (fs.existsSync(nycOutput)) {
	fs.rmSync(nycOutput, { recursive: true });
}
fs.mkdirSync(nycOutput, { recursive: true });

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

let testsFailed = false;

try {
	// Instrument extension code in-place (test files excluded via .nycrc.json)
	run('npx nyc instrument --in-place out');

	// Patch VS Code test instance (Windows mutex workaround)
	run('node scripts/modules/patch-vscode-test.js');

	// Run tests with coverage collection hook
	run('npx vscode-test --file ./out/test/coverage-hook.js');
} catch {
	testsFailed = true;
} finally {
	// Restore un-instrumented files (safe to fail — next compile fixes it)
	try {
		run('npm run compile-tests');
	} catch {
		console.warn('Warning: could not restore out/ — run compile-tests manually');
	}
}

// Generate report even if tests failed (shows partial coverage)
run('npx nyc report');

if (testsFailed) {
	console.error('Tests failed — see output above');
	process.exit(1);
}

// Check coverage thresholds
run('npx nyc check-coverage');
