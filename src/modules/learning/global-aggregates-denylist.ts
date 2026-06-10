/**
 * Privacy deny-list for cross-workspace pattern promotion (plan 053, Workstream D).
 *
 * This is the LOAD-BEARING privacy check: a pattern is only eligible to leave the current
 * workspace's storage if it carries no workspace-identifying content. Promotion writes the
 * pattern text into VS Code globalState, which is shared across every workspace on the machine,
 * so anything project-, path-, or user-specific must never pass. The check is intentionally
 * conservative — a false reject only means a generic pattern isn't shared; a false accept could
 * leak a project name or local path. When unsure, reject.
 *
 * Pure and side-effect-free so the rules are fixture-testable in isolation.
 */

/** Patterns that signal workspace/user/project-identifying content — any hit rejects promotion. */
const DENY_RULES: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> = [
    // Windows absolute path: C:\…, \\server\share
    { name: "windows-path", re: /(^|[^A-Za-z])[A-Za-z]:[\\/]/ },
    { name: "unc-path", re: /\\\\[^\\]+\\/ },
    // POSIX home/user/temp absolute paths
    { name: "posix-home", re: /\/(?:home|Users|root)\// },
    { name: "posix-abs", re: /(?:^|\s)\/(?:usr|opt|var|etc|tmp|private|mnt|srv|data)\// },
    // file:// URIs (carry absolute paths)
    { name: "file-uri", re: /file:\/\//i },
    // Windows user profile env expansions and explicit user dirs
    { name: "user-profile", re: /(?:%USERPROFILE%|%APPDATA%|%LOCALAPPDATA%|\bUsers[\\/][^\\/\s]+)/i },
    // Email addresses (often a developer identity)
    { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
    // Git remotes / hosts that embed an org or user
    { name: "git-remote", re: /(?:github\.com|gitlab\.com|bitbucket\.org)[:/]/i },
    // package: imports name the app/package (Dart/Flutter) — project-identifying
    { name: "package-import", re: /\bpackage:[A-Za-z_][A-Za-z0-9_]*/ },
];

/** Result of a deny-list evaluation. */
export interface DenyListResult {
    /** True when the pattern is safe to promote (no identifying content matched). */
    readonly allowed: boolean;
    /** The name of the first rule that matched, when rejected (for diagnostics/tests). */
    readonly matchedRule?: string;
}

/**
 * Evaluate a pattern against the deny-list. Returns `allowed: false` (with the matched rule
 * name) on the first identifying-content hit, otherwise `allowed: true`.
 */
export function checkPromotionDenyList(pattern: string): DenyListResult {
    for (const rule of DENY_RULES) {
        if (rule.re.test(pattern)) {
            return { allowed: false, matchedRule: rule.name };
        }
    }
    return { allowed: true };
}

/** Convenience boolean: true when the pattern carries no workspace-identifying content. */
export function isPromotable(pattern: string): boolean {
    return checkPromotionDenyList(pattern).allowed;
}
