/**
 * Copy missing config.*.title keys from package.nls.json into all package.nls.*.json.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const enPath = path.join(root, 'package.nls.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const titleKeys = Object.keys(en).filter((k) => k.endsWith('.title') && k.startsWith('config.'));

const files = fs.readdirSync(root).filter((f) => f.startsWith('package.nls') && f.endsWith('.json') && f !== 'package.nls.json');

for (const f of files) {
	const p = path.join(root, f);
	const o = JSON.parse(fs.readFileSync(p, 'utf8'));
	let n = 0;
	for (const k of titleKeys) {
		if (o[k] !== en[k]) {
			o[k] = en[k];
			n++;
		}
	}
	fs.writeFileSync(p, `${JSON.stringify(o, null, 2)}\n`);
	console.log(`${f}: updated ${n} title key(s)`);
}
