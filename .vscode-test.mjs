import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	launchArgs: ['--disable-updates'],
	// 'min' reporter prints only the run summary and failure details — it suppresses
	// the per-test pass list (hundreds of ✔ lines) that floods the terminal on a green run.
	// Failures and their stack traces are still shown in full.
	mocha: {
		reporter: 'min',
	},
});
