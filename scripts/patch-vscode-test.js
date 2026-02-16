/**
 * Patches downloaded VS Code test instances to skip the Windows Inno Setup
 * mutex check. Without this, tests fail with "Code is currently being updated"
 * when a stale vscodesetup mutex exists on the system.
 *
 * Called automatically before `vscode-test` in the test npm script.
 */
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', '.vscode-test');
if (!fs.existsSync(testDir)) {
	process.exit(0);
}

for (const entry of fs.readdirSync(testDir)) {
	if (!entry.startsWith('vscode-')) {
		continue;
	}

	const vscodeDir = path.join(testDir, entry);
	// product.json is nested: .vscode-test/<version>/<hash>/resources/app/product.json
	const candidates = [];
	try {
		for (const sub of fs.readdirSync(vscodeDir)) {
			candidates.push(
				path.join(vscodeDir, sub, 'resources', 'app', 'product.json'),
			);
		}
	} catch {
		// Might be a file, not a directory
		candidates.push(
			path.join(vscodeDir, 'resources', 'app', 'product.json'),
		);
	}

	for (const productPath of candidates) {
		if (!fs.existsSync(productPath)) {
			continue;
		}
		const product = JSON.parse(fs.readFileSync(productPath, 'utf8'));
		if (!product.win32VersionedUpdate) {
			continue;
		}
		delete product.win32VersionedUpdate;
		fs.writeFileSync(productPath, JSON.stringify(product, null, '\t'));
		console.log(`Patched: ${productPath}`);
	}
}
