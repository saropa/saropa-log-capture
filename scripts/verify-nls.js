// @ts-check
/** Verify NLS key alignment between package.json and package.nls*.json files. */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

/** Extract all %key% references from a JSON string. */
function extractRefs(jsonText) {
	const refs = [];
	const re = /%([a-zA-Z0-9.]+)%/g;
	let match;
	while ((match = re.exec(jsonText)) !== null) {
		refs.push(match[1]);
	}
	return refs;
}

/** Find all package.nls*.json files in the project root. */
function findNlsFiles() {
	return fs.readdirSync(root).filter(f =>
		f.startsWith('package.nls') && f.endsWith('.json')
	);
}

const pkgText = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const refs = extractRefs(pkgText);
const nlsFiles = findNlsFiles();

if (nlsFiles.length === 0) {
	console.error('ERROR: No package.nls*.json files found.');
	process.exit(1);
}

let hasErrors = false;

for (const nlsFile of nlsFiles) {
	const nlsPath = path.join(root, nlsFile);
	const nls = JSON.parse(fs.readFileSync(nlsPath, 'utf8'));
	const nlsKeys = Object.keys(nls);

	const missing = refs.filter(k => nlsKeys.indexOf(k) === -1);
	const orphan = nlsKeys.filter(k => refs.indexOf(k) === -1);

	if (missing.length > 0 || orphan.length > 0) {
		hasErrors = true;
		console.error(`\n${nlsFile}:`);
		if (missing.length > 0) {
			console.error(`  MISSING (in package.json but not in ${nlsFile}):`);
			missing.forEach(k => console.error(`    - ${k}`));
		}
		if (orphan.length > 0) {
			console.error(`  ORPHAN (in ${nlsFile} but not in package.json):`);
			orphan.forEach(k => console.error(`    - ${k}`));
		}
	} else {
		console.log(`${nlsFile}: ${nlsKeys.length} keys aligned.`);
	}
}

if (hasErrors) {
	console.error('\nNLS verification FAILED.');
	process.exit(1);
} else {
	console.log(`\nNLS verification passed. ${refs.length} keys, ${nlsFiles.length} file(s).`);
}
