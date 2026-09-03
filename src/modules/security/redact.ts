/**
 * Sensitive-content redaction (bug_003): a single, shared pass that strips secrets before text
 * leaves the extension — bug report bodies and the AI "Explain" context both route through this
 * so a fix here closes every leak vector at once instead of patching each surface separately.
 */

// Matches "Bearer <token>" and "Authorization: <token>" (case-insensitive, optional colon+space
// after Authorization) so both header styles and inline log mentions are caught in one pass.
const BEARER_AUTH_RE = /(Bearer|Authorization:?\s*)\S+/gi;

// Windows user-profile paths — both backslash form (C:\Users\craig\...) and forward-slash form
// (C:/Users/craig/..., as produced by vscode://file/ URIs whose path segments always use "/" —
// see link-helpers.ts buildVscodeFileUri, which normalizes "\\" to "/" before building the URI).
// A regex scoped only to "\\" silently let the forward-slash form straight through, which was the
// exact leak bug_003 cited (a `vscode://file/C:/Users/<name>/...` link in a shared bug report).
// Captured length-greedy up to whitespace or a quote/bracket so the whole path is replaced.
const WINDOWS_USER_PATH_RE = /[A-Za-z]:[\\/]Users[\\/][^\s"'`<>]*/g;

// Unix-style home directories on Linux (/home/<user>/...) and macOS (/Users/<user>/...) — same
// leading-username exposure as the Windows case, just a different filesystem convention.
const UNIX_HOME_PATH_RE = /\/(?:home|Users)\/[^\s"'`<>]*/g;

// Query-string secrets: "?token=...", "&api_key=...", etc. The key name is preserved (useful for
// diagnosing which parameter carried a secret) but its value is dropped.
const QUERY_STRING_SECRET_RE = /([?&](token|key|secret|password|api_key|access_token|auth)=)[^&\s]+/gi;

/**
 * Redact bearer/authorization tokens, absolute user-directory paths, and query-string secrets
 * from arbitrary text. Applied to bug report bodies and AI context before either leaves the
 * machine (bug_003) — call this on every chunk of captured log/stack content, not just headers.
 */
export function redactSensitiveContent(text: string): string {
    if (!text) { return text; }
    return text
        .replace(BEARER_AUTH_RE, '$1 [REDACTED]')
        .replace(WINDOWS_USER_PATH_RE, '[PATH_REDACTED]')
        .replace(UNIX_HOME_PATH_RE, '[PATH_REDACTED]')
        .replace(QUERY_STRING_SECRET_RE, '$1[REDACTED]');
}
