/**
 * Fix titles that end mid-phrase (e.g. "(e.g.") — replace with humanized key suffix.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const nlsPath = path.join(root, 'package.nls.json');
const nls = JSON.parse(fs.readFileSync(nlsPath, 'utf8'));

function humanizeSuffix(suffix) {
	return suffix
		.split('.')
		.map((part) => {
			const spaced = part.replaceAll(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
			return spaced.length === 0 ? '' : spaced.charAt(0).toUpperCase() + spaced.slice(1);
		})
		.join(' › ');
}

/** True if the title string was truncated mid-parenthetical and should be replaced. */
function isTruncatedTitle(val) {
	const t = val.trim();
	const lower = t.toLowerCase();
	return (
		t.endsWith('(') ||
		lower.endsWith('(e.g') ||
		lower.endsWith('(e.g.')
	);
}

let n = 0;
for (const key of Object.keys(nls)) {
	if (!key.endsWith('.title') || !key.startsWith('config.')) {
		continue;
	}
	const val = nls[key];
	if (typeof val !== 'string') {
		continue;
	}
	if (!isTruncatedTitle(val)) {
		continue;
	}
	const suffix = key.slice('config.'.length, -'.title'.length);
	nls[key] = humanizeSuffix(suffix);
	n++;
}

fs.writeFileSync(nlsPath, `${JSON.stringify(nls, null, 2)}\n`);
console.log(`Fixed ${n} truncated titles in package.nls.json`);
