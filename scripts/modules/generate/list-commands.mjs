// @ts-check
/**
 * Generates plans/reference/contributes-commands.md from package.json contributes.commands.
 * --check also verifies the manifest and the source tree agree BOTH directions (bug_043):
 * previously it only checked catalog freshness, so a `registerCommand()` call with no
 * matching `contributes.commands` entry (undeclared — invisible in the Command Palette,
 * no title/category) went undetected. Declared-but-unregistered is caught too, since a
 * manifest entry with no handler throws "command not found" the first time it's invoked.
 *
 *   node scripts/modules/generate/list-commands.mjs
 *   node scripts/modules/generate/list-commands.mjs --check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const outRel = "plans/reference/contributes-commands.md";
const outPath = path.join(root, outRel);
const srcDir = path.join(root, "src");

/** Recursively read every .ts file under `dir` (excluding src/test) into a single text blob for scanning. */
function readSrcTsFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// Test files may register throwaway/mock command ids that never belong in the
			// manifest — excluding src/test keeps the check free of false positives.
			if (entry.name === "test") { continue; }
			readSrcTsFiles(full, out);
			continue;
		}
		if (entry.name.endsWith(".ts")) { out.push(fs.readFileSync(full, "utf8")); }
	}
	return out;
}

/**
 * Helper functions in src/commands-export-helpers.ts build the id from a template literal
 * (`` `saropaLogCapture.${name}` ``) rather than a literal string, so the direct regex below
 * can't see the final id — it has to be resolved from each helper's call sites instead. This
 * table is a documented heuristic, not general call-graph resolution: a new indirection
 * pattern needs its own entry here or the bidirectional check will miss it silently.
 */
const FORWARDING_HELPERS = [
	// fileExportCmd('exportCsv', fn) / htmlExportCmd('exportHtml', fn) — positional literal id.
	{ re: /\bfileExportCmd\(\s*['"]([a-zA-Z0-9.]+)['"]/g },
	{ re: /\bhtmlExportCmd\(\s*['"]([a-zA-Z0-9.]+)['"]/g },
	// buildCiTokenCmd(context, { commandId: 'setBuildCiGithubToken', ... }) — named property.
	{ re: /\bbuildCiTokenCmd\([\s\S]*?commandId:\s*['"]([a-zA-Z0-9.]+)['"]/g },
];

/** Collect every command id registered under src/, including indirect (aliased/forwarded) registrations. */
function collectRegisteredCommandIds(dir) {
	const ids = new Set();
	const texts = readSrcTsFiles(dir);
	const directRe = /registerCommand\(\s*['"]([a-zA-Z0-9.]+)['"]/g;
	// Local aliases, e.g. `const reg = vscode.commands.registerCommand;` then `reg('id', ...)` —
	// scoped per-file so an alias name reused for something unrelated in another file can't leak in.
	const aliasDeclRe = /\b(?:const|let)\s+(\w+)\s*=\s*vscode\.commands\.registerCommand\b/g;
	for (const text of texts) {
		let m;
		directRe.lastIndex = 0;
		while ((m = directRe.exec(text))) { ids.add(m[1]); }

		aliasDeclRe.lastIndex = 0;
		let aliasMatch;
		while ((aliasMatch = aliasDeclRe.exec(text))) {
			const aliasCallRe = new RegExp(`\\b${aliasMatch[1]}\\(\\s*['"]([a-zA-Z0-9.]+)['"]`, "g");
			let callMatch;
			while ((callMatch = aliasCallRe.exec(text))) { ids.add(callMatch[1]); }
		}

		for (const { re } of FORWARDING_HELPERS) {
			re.lastIndex = 0;
			let helperMatch;
			while ((helperMatch = re.exec(text))) { ids.add(`saropaLogCapture.${helperMatch[1]}`); }
		}
	}
	return ids;
}

/** Bidirectional diff between the manifest's declared commands and src/'s registered commands. */
function checkBidirectional(declaredIds) {
	const registeredIds = collectRegisteredCommandIds(srcDir);
	const undeclared = [...registeredIds].filter((id) => !declaredIds.has(id)).sort();
	const unregistered = [...declaredIds].filter((id) => !registeredIds.has(id)).sort();
	let ok = true;
	if (undeclared.length > 0) {
		ok = false;
		console.error(`ERROR: ${undeclared.length} command(s) registered in src/ but missing from contributes.commands:`);
		for (const id of undeclared) { console.error(`  - ${id}`); }
	}
	if (unregistered.length > 0) {
		ok = false;
		console.error(`ERROR: ${unregistered.length} command(s) declared in contributes.commands but never registered in src/:`);
		for (const id of unregistered) { console.error(`  - ${id}`); }
	}
	return ok;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
/** @type {{ command?: string; title?: string; category?: string; icon?: string }[]} */
const cmds = Array.isArray(pkg.contributes?.commands) ? pkg.contributes.commands : [];

function escCell(s) {
	return String(s ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/\|/g, "\\|")
		.replace(/\r?\n/g, " ");
}

const rows = [...cmds]
	.filter((c) => c && typeof c.command === "string")
	.sort((a, b) => a.command.localeCompare(b.command));

const lines = [
	"# Extension command IDs (`contributes.commands`)",
	"",
	"<!-- AUTO-GENERATED by scripts/modules/generate/list-commands.mjs — do not edit by hand. -->",
	"",
	"Reference for keybinding `command` values and automation. Titles are raw `package.json` strings (often `%command.*.title%` NLS keys).",
	"",
	"| Command ID | Title | Category |",
	"|------------|-------|----------|",
];
for (const c of rows) {
	lines.push(`| \`${escCell(c.command)}\` | ${escCell(c.title)} | ${escCell(c.category)} |`);
}
lines.push("", `**Total:** ${rows.length} commands.`, "");
const body = lines.join("\n");

const check = process.argv.includes("--check");
if (check) {
	if (!fs.existsSync(outPath)) {
		console.error(`ERROR: ${outRel} missing. Run: node scripts/modules/generate/list-commands.mjs`);
		process.exit(1);
	}
	const existing = fs.readFileSync(outPath, "utf8");
	let ok = true;
	if (existing !== body) {
		ok = false;
		console.error(`ERROR: ${outRel} is out of date. Run: node scripts/modules/generate/list-commands.mjs`);
	}
	// bug_043: catalog freshness alone missed commands present in one of {manifest, src/}
	// but not the other — check both directions before declaring the gate green.
	const declaredIds = new Set(rows.map((c) => c.command));
	if (!checkBidirectional(declaredIds)) { ok = false; }
	if (!ok) { process.exit(1); }
	console.log(`OK: ${outRel} matches package.json, and every command is declared + registered.`);
} else {
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, body, "utf8");
	console.log(`Wrote ${outRel} (${lines.length} lines).`);
}
