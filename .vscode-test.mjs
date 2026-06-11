import { defineConfig } from '@vscode/test-cli';
import { listMochaTestFiles } from './scripts/modules/test/node-test-files.mjs';

// Only Mocha suites run in the Extension Development Host. The project's
// node:test files are excluded here and run separately by run-node-tests.mjs
// with the quiet `dot` reporter — otherwise they auto-run under node's own
// runner inside this process and flood the terminal with `spec` output (one ✔
// per passing test) that no vscode-test/mocha setting can suppress.
// Falls back to the broad glob only when out/test has not been built yet (the
// scan returns nothing), so a misordered run still finds tests.
const mochaFiles = listMochaTestFiles();

export default defineConfig({
	files: mochaFiles.length > 0 ? mochaFiles : 'out/test/**/*.test.js',
	launchArgs: ['--disable-updates'],
	// 'min' reporter prints only the run summary and failure details — it suppresses
	// the per-test pass list (hundreds of ✔ lines) that floods the terminal on a green run.
	// Failures and their stack traces are still shown in full.
	mocha: {
		reporter: 'min',
	},
});
