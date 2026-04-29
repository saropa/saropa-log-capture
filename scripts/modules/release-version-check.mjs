// @ts-check
/**
 * Verifies package.json "version" has a matching ## [version] section in CHANGELOG.md.
 * Run before tagging or publishing. Optional: --tag checks that git HEAD is tagged v{version}.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const ver = String(pkg.version ?? "").trim();
if (!/^\d+\.\d+\.\d+/.test(ver)) {
	console.error("ERROR: package.json version missing or invalid.");
	process.exit(1);
}

const chPath = path.join(root, "CHANGELOG.md");
const ch = fs.readFileSync(chPath, "utf8");
const heading = new RegExp(`^## \\[${ver.replace(/\./g, "\\.")}\\]`, "m");
if (!heading.test(ch)) {
	console.error(`ERROR: CHANGELOG.md has no section heading ## [${ver}]`);
	process.exit(1);
}
console.log(`OK: CHANGELOG.md contains ## [${ver}]`);

if (process.argv.includes("--tag")) {
	let tag = "";
	try {
		tag = execSync("git describe --tags --exact-match HEAD", { cwd: root, encoding: "utf8" }).trim();
	} catch {
		tag = "";
	}
	const want = `v${ver}`;
	if (tag !== want) {
		console.error(`ERROR: expected git tag ${want} on HEAD, got: ${tag || "(none)"}`);
		process.exit(1);
	}
	console.log(`OK: HEAD is tagged ${tag}`);
}
