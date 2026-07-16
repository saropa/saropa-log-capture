// @ts-check
/**
 * Preflight check: warns when mergeable dependabot PRs are waiting.
 * Requires `gh` CLI authenticated. Non-blocking (exit 0) — prints a warning
 * so the developer can merge before publishing, but never gates the build.
 *
 * Run standalone: node scripts/modules/verify/verify-open-prs.mjs
 */
import { execSync } from "node:child_process";

/**
 * @returns {{ number: number, title: string, statusCheckRollup: string }[]}
 */
function fetchOpenDependabotPrs() {
	try {
		const json = execSync(
			'gh pr list --author "app/dependabot" --state open --json number,title,statusCheckRollup --limit 20',
			{ encoding: "utf8", timeout: 15_000 },
		);
		return JSON.parse(json);
	} catch {
		// gh not installed, not authenticated, or no network — skip silently
		return [];
	}
}

/** @param {{ statusCheckRollup: string }} pr */
function ciPassed(pr) {
	// statusCheckRollup is "SUCCESS", "FAILURE", "PENDING", or "" (no checks)
	return pr.statusCheckRollup === "SUCCESS";
}

const prs = fetchOpenDependabotPrs();
if (prs.length === 0) {
	console.log("OK: no open dependabot PRs.");
	process.exit(0);
}

const mergeable = prs.filter(ciPassed);
const pending = prs.filter((pr) => !ciPassed(pr));

if (mergeable.length > 0) {
	console.warn("WARNING: open dependabot PRs with passing CI — consider merging before publish:");
	for (const pr of mergeable) {
		console.warn(`  #${pr.number}  ${pr.title}`);
	}
}

if (pending.length > 0) {
	console.log(`INFO: ${pending.length} dependabot PR(s) with pending/failing CI (skipped).`);
}

if (mergeable.length === 0) {
	console.log("OK: no mergeable dependabot PRs waiting.");
}
