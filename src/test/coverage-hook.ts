/**
 * Coverage hook loaded via `--file` during coverage runs only.
 * Writes Istanbul's `__coverage__` object to `.nyc_output/` so
 * `nyc report` can generate the coverage report.
 *
 * Uses `process.on('exit')` because the `--file` script runs
 * before mocha globals (`after`, `suite`, etc.) are available.
 *
 * This runs inside VS Code's Extension Host process, which is why
 * we use Node `fs` (not `vscode.workspace.fs`).
 */
import * as fs from 'fs';
import * as path from 'path';

process.on('exit', () => {
	const cov = (global as Record<string, unknown>).__coverage__;
	if (!cov) {
		return;
	}

	const dir = path.resolve(__dirname, '..', '..', '.nyc_output');
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, 'coverage-final.json'),
		JSON.stringify(cov),
	);
});
