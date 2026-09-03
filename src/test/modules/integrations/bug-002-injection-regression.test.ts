/**
 * Regression test for bug_002 (security: shell-string injection via workspace settings).
 *
 * The docker/container, Linux-logs, and Windows-Event-Log integrations used to build shell
 * commands with `execSync(`${runtime} ${args.join(' ')}`)` / `exec(...)` — a single string
 * re-parsed by a shell. Because `runtime`, `containerId`, `containerNamePattern`, and
 * `wslDistro` all come straight from workspace settings (untrusted: committed in a repo's
 * .vscode/settings.json), a value containing `;`, `&&`, or backticks could execute arbitrary
 * commands on the user's machine the moment a debug session started or ended.
 *
 * The fix switched every one of these call sites to `execFile`/`execFileSync`, which pass
 * `args` as a literal argv array with no shell involved, so shell metacharacters in any
 * element are inert.
 *
 * A live behavioral test (monkey-patching `child_process`) was attempted but this runtime's
 * `child_process` module exports are non-configurable — `Object.defineProperty` throws
 * "Cannot redefine property" even with `configurable: true` requested, so the function
 * cannot be safely swapped out from a test. This is a static regression guard instead: it
 * reads each provider's compiled source and asserts the vulnerable shell-string pattern
 * (`exec(Sync)?` fed a template string built from `runtime`/`cmd`) is gone and the safe
 * `execFile` family is present. It will fail loudly if any of these three call sites is ever
 * reverted to string-concatenated `execSync`/`exec`.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/** Reads a provider's TypeScript source relative to the repo root. */
function readProviderSource(relativePath: string): string {
    // out/test/modules/integrations -> repo root is 4 levels up.
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    return fs.readFileSync(path.join(repoRoot, 'src', relativePath), 'utf-8');
}

suite('command injection regression (bug_002)', () => {
    test('docker-containers.ts uses execFileSync, never execSync with a concatenated command string', () => {
        const src = readProviderSource('modules/integrations/providers/docker-containers.ts');
        assert.ok(src.includes('execFileSync'), 'expected execFileSync import/usage');
        assert.ok(!/execSync\s*\(\s*`/.test(src), 'execSync must never be called with a template-string command');
        assert.ok(!src.includes("import { execSync } from 'child_process'"), 'execSync must not be imported');
    });

    test('linux-logs.ts uses execFile, never a joined shell-string command', () => {
        const src = readProviderSource('modules/integrations/providers/linux-logs.ts');
        assert.ok(src.includes('execFile'), 'expected execFile import/usage');
        // The vulnerable pattern joined argv into one string before handing it to exec().
        assert.ok(!/execAsync\s*\(\s*\[[^\]]*\]\.join\(/.test(src), 'must not join argv into a single exec() string');
        assert.ok(!/`wsl \$\{/.test(src), 'wslDistro must never be interpolated into a shell-string template');
    });

    test('windows-event-log.ts uses execFileSync with an argv array for the PowerShell invocation', () => {
        const src = readProviderSource('modules/integrations/providers/windows-event-log.ts');
        assert.ok(src.includes('execFileSync'), 'expected execFileSync import/usage');
        assert.ok(!/execSync\s*\(\s*`powershell/.test(src), 'powershell must never be launched via a concatenated command string');
    });

    test('build-ci-api.ts gates gitlabBaseUrl on workspace trust before sending the PRIVATE-TOKEN header', () => {
        const src = readProviderSource('modules/integrations/providers/build-ci-api.ts');
        assert.ok(src.includes('vscode.workspace.isTrusted'), 'expected a vscode.workspace.isTrusted gate on the workspace-scoped gitlabBaseUrl');
        // An override host is only meaningful if there is a known-safe default to fall
        // back to when the workspace is untrusted — without one, "gate on trust" would
        // have nothing safe to resolve to.
        assert.ok(src.includes('GITLAB_DEFAULT_BASE_URL'), 'expected a hardcoded default GitLab host to fall back to in untrusted workspaces');
        // The trust-gated resolver must be defined (and therefore usable) before the
        // PRIVATE-TOKEN header is ever attached to a request, so the exfiltration
        // fix cannot be silently bypassed by a future edit that reorders the file.
        const resolveIdx = src.indexOf('function resolveTrustedGitLabBaseUrl');
        const privateTokenIdx = src.indexOf("'PRIVATE-TOKEN'");
        assert.ok(resolveIdx !== -1, 'expected a resolveTrustedGitLabBaseUrl function');
        assert.ok(privateTokenIdx !== -1, 'expected the PRIVATE-TOKEN header to still be sent for GitLab requests');
        assert.ok(resolveIdx < privateTokenIdx, 'the trust gate must be defined before the PRIVATE-TOKEN header is attached');
    });

    test('windows-event-log.ts escapes single quotes before embedding workspace-scoped log names in PowerShell', () => {
        const src = readProviderSource('modules/integrations/providers/windows-event-log.ts');
        // `cfg.logs` (event log names) is a workspace-scoped setting embedded inside a
        // PowerShell single-quoted string literal (`@('...')`); without escaping, a log
        // name containing `'` could break out of the literal and inject PowerShell.
        assert.ok(src.includes('escapePowerShellSingleQuoted'), 'expected event log names to be escaped before embedding in the PowerShell script');
        assert.ok(/logs\.map\(l\s*=>\s*`'\$\{escapePowerShellSingleQuoted\(l\)\}'`\)/.test(src), 'each log name must be routed through escapePowerShellSingleQuoted before being wrapped in quotes');
    });
});
