/**
 * Semantic error grouping (cross-session-analysis idea #13).
 *
 * Maps an error line to a meaning-based category — network, filesystem, validation, permission,
 * concurrency, memory — rather than relying on the exact class name or fingerprint hash. Errors
 * that fail the same way ("Connection refused", "Future not completed", "Failed host lookup") then
 * group under one heading, which is more useful than three separate exact-text fingerprints.
 *
 * Pure (no vscode import) and language-agnostic in spirit: the pattern library covers the common
 * Dart/JS/Java/Python class names and message fragments seen in captured logs. Unit-testable under
 * `node --test`. Returns 'other' when nothing matches, so callers can choose to omit the label.
 */

/** Meaning-based error category. 'other' is the explicit no-match fallback. */
export type ErrorSemanticCategory =
    | 'network'
    | 'filesystem'
    | 'permission'
    | 'validation'
    | 'concurrency'
    | 'memory'
    | 'other';

/**
 * Ordered category → matchers. Order matters: more specific categories come first so a line that
 * could match several (e.g. a permission denial mentioning a file) lands in the most informative
 * one. Permission precedes filesystem for exactly that reason.
 */
const CATEGORY_PATTERNS: readonly { readonly category: ErrorSemanticCategory; readonly patterns: readonly RegExp[] }[] = [
    {
        category: 'memory',
        patterns: [/OutOfMemory/i, /\bOOM\b/, /out of memory/i, /heap (?:space|limit|out)/i],
    },
    {
        category: 'permission',
        patterns: [/SecurityException/i, /permission denied/i, /\bEACCES\b/, /not permitted/i, /unauthor[iz]/i, /access is denied/i],
    },
    {
        category: 'network',
        patterns: [
            /SocketException/i, /TimeoutException/i, /HttpException/i, /ClientException/i,
            /connection (?:refused|reset|closed|timed out|aborted)/i, /failed host lookup/i,
            /\bECONNREFUSED\b/, /\bETIMEDOUT\b/, /\bENOTFOUND\b/, /network is unreachable/i,
        ],
    },
    {
        category: 'filesystem',
        patterns: [
            /FileSystemException/i, /PathNotFoundException/i, /FileNotFound/i, /\bENOENT\b/,
            /no such file or directory/i, /directory not (?:empty|found)/i,
        ],
    },
    {
        category: 'concurrency',
        patterns: [/ConcurrentModification/i, /deadlock/i, /\brace condition\b/i, /already (?:completed|listened)/i],
    },
    {
        category: 'validation',
        patterns: [
            /FormatException/i, /RangeError/i, /\bTypeError\b/i, /ArgumentError/i,
            /null check operator/i, /is not a subtype of/i, /out of range/i, /invalid (?:argument|format|value|input)/i,
        ],
    },
];

/**
 * Classify an error line into a semantic category. Scans the ordered pattern library and returns
 * the first category whose any pattern matches; 'other' when none do.
 */
export function classifyErrorSemantics(text: string): ErrorSemanticCategory {
    if (!text) { return 'other'; }
    for (const { category, patterns } of CATEGORY_PATTERNS) {
        if (patterns.some((re) => re.test(text))) { return category; }
    }
    return 'other';
}
