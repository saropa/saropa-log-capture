/**
 * Verify that every `contributes.walkthroughs[*].steps[*].media` path in package.json
 * resolves to a real file that also survives packaging (.vscodeignore).
 *
 * Bug 001: the walkthrough markdown was moved from media/walkthrough/ to
 * plans/walkthrough/ in a doc-consolidation commit, but package.json still pointed at
 * media/walkthrough/*.md. plans/** is excluded from the .vsix, so every walkthrough step
 * shipped with an empty body for six releases and nothing caught it. This check exists so
 * that class of break fails `npm run compile` instead of shipping silently.
 *
 * Run: node scripts/modules/verify/verify-walkthrough-media.mjs   (wired into `npm run compile`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve('.');

/** Top-level directories .vscodeignore excludes wholesale (e.g. "plans/**" -> "plans").
 * A media path resolving under one of these would exist in the repo but not in the .vsix. */
function packagedExcludedDirs() {
    const text = fs.readFileSync(path.join(ROOT, '.vscodeignore'), 'utf-8');
    const dirs = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('!')) { continue; }
        const m = line.match(/^([\w.-]+)\/\*\*$/);
        if (m) { dirs.push(m[1]); }
    }
    return dirs;
}

/** Every media.markdown / media.image path declared under contributes.walkthroughs. */
function walkthroughMediaPaths(pkg) {
    const paths = [];
    const walkthroughs = pkg.contributes?.walkthroughs ?? [];
    for (const wt of walkthroughs) {
        for (const step of wt.steps ?? []) {
            const media = step.media ?? {};
            if (media.markdown) { paths.push({ stepId: step.id, kind: 'markdown', value: media.markdown }); }
            if (media.image) { paths.push({ stepId: step.id, kind: 'image', value: media.image }); }
        }
    }
    return paths;
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const mediaPaths = walkthroughMediaPaths(pkg);
const excludedDirs = packagedExcludedDirs();

if (mediaPaths.length === 0) {
    console.log('verify:walkthrough-media — OK (no walkthrough media declared)');
    process.exit(0);
}

const errors = [];
for (const entry of mediaPaths) {
    const abs = path.join(ROOT, entry.value);
    if (!fs.existsSync(abs)) {
        errors.push(`  step "${entry.stepId}": ${entry.kind} "${entry.value}" does not exist on disk`);
        continue;
    }
    const topDir = entry.value.split('/')[0];
    if (excludedDirs.includes(topDir)) {
        errors.push(`  step "${entry.stepId}": ${entry.kind} "${entry.value}" resolves inside "${topDir}/", `
            + `which .vscodeignore excludes from the .vsix — it will render empty at runtime`);
    }
}

if (errors.length === 0) {
    console.log(`verify:walkthrough-media — OK (${mediaPaths.length} walkthrough media path(s) resolve and ship)`);
    process.exit(0);
}
console.error(`verify:walkthrough-media — FAIL: ${errors.length} walkthrough media path(s) broken\n`);
for (const e of errors) { console.error(e); }
process.exit(1);
