/**
 * App-emitted log tag dictionary: maps a recognized head bracket tag to a
 * severity level so the viewer's level filter dots can group lines the
 * content heuristic cannot classify on its own.
 *
 * Why this exists: an app's own log lines (e.g. `bulkPreload DRIFT WRITE DONE`)
 * are database-adjacent but carry no signal the classifier can read — "bulkPreload"
 * is app vocabulary. Prefixing a recognized tag (`[db] bulkPreload …`) routes the
 * line to the `database` level so the DB filter dot hides it as a group.
 *
 * Tag format is `[TAG:optional metadata]`. The derived tag name is everything
 * before the FIRST colon; the metadata after it stays visible inline in the line
 * (extra debug context the app wanted to surface). See `headBracketTagPattern`.
 *
 * SAFE vs RISKY recognition: an explicit HEAD BRACKET tag (`[db]`) is an
 * intentional marker and is safe to honor. The same bare tokens in free text
 * (`db`, `sql`, `query`, `orm`, `cache`, `mongo`, `redis`) are NOT — they collide
 * with ordinary English and identifiers, so they are deliberately absent from the
 * free-text vendor regex in level-classifier.ts (see its `databaseVendorTokens`
 * comment) and live ONLY here, gated behind the bracket-tag requirement.
 *
 * This is structural vocabulary (like `databaseVendorTokens`), not user-tunable,
 * so it is a hardcoded constant rather than a config/NLS setting. It is the single
 * source of truth: the extension classifier imports it; the webview classifier
 * bakes it in via {@link tagLevelMapJson} (the webview script is a string template
 * and cannot import).
 *
 * Only NON-`info` levels are listed. Tags that would map to `info` need no code —
 * they already work as open-vocabulary source-tag chips — and live only in the
 * README "Log Tag Vocabulary" list as recommended app vocabulary.
 */

/** Valid severity levels. Defined here so the dictionary and classifier share one type. */
export type SeverityLevel =
    | 'info'
    | 'warning'
    | 'error'
    | 'performance'
    | 'todo'
    | 'debug'
    | 'notice'
    | 'database';

/**
 * Recognized head-tag synonym → severity level. Keys are lowercase; {@link lookupTagLevel}
 * lowercases its input so `[DB]`, `[Db]`, `[db]` all resolve. Because the classifier runs this
 * lookup AFTER its error check and BEFORE the warning/perf keyword sweep, an `error`-mapped tag
 * only ever upgrades an otherwise-`info` line — it never downgrades a real structural error.
 */
export const TAG_LEVEL_MAP: Readonly<Record<string, SeverityLevel>> = {
    // database / storage / ORM
    db: 'database', database: 'database', sql: 'database', query: 'database', drift: 'database',
    isar: 'database', sqlite: 'database', sqlite3: 'database', sqflite: 'database', hive: 'database',
    realm: 'database', postgres: 'database', mysql: 'database', mongo: 'database', mongodb: 'database',
    dynamodb: 'database', redis: 'database', orm: 'database', dao: 'database', prisma: 'database',
    sequelize: 'database', migration: 'database', rowcount: 'database',
    // error
    err: 'error', error: 'error', fatal: 'error', panic: 'error', crash: 'error',
    exception: 'error', abort: 'error',
    // warning
    warn: 'warning', warning: 'warning', caution: 'warning', deprecated: 'warning', retry: 'warning',
    fallback: 'warning', degraded: 'warning',
    // performance
    perf: 'performance', performance: 'performance', slow: 'performance', latency: 'performance',
    timing: 'performance', profile: 'performance', jank: 'performance', frame: 'performance',
    fps: 'performance', gc: 'performance', memory: 'performance', bench: 'performance',
    benchmark: 'performance', 'frame-stall': 'performance',
    // todo
    todo: 'todo', fixme: 'todo', hack: 'todo', xxx: 'todo', kludge: 'todo', workaround: 'todo',
    'tech-debt': 'todo',
    // notice
    notice: 'notice', note: 'notice', important: 'notice', banner: 'notice', milestone: 'notice',
    lifecycle: 'notice',
    // debug
    debug: 'debug', trace: 'debug', verbose: 'debug', breadcrumb: 'debug', dump: 'debug',
    spew: 'debug', devlog: 'debug',
};

/**
 * Optional saved-log wrapper `[HH:MM:SS.mmm] [source]` at line start. log-session-
 * helpers.ts's `formatLine()` always writes both brackets together when a captured
 * line is saved to a `.log` file — `source` (the category) is an unrestricted string
 * end to end, so this only recognizes the wrapper by its fixed timestamp shape, then
 * unconditionally consumes the very next bracket as the source label. Without this,
 * re-opening a saved log left every app-emitted tag (`[db]`, `[perf]`,
 * `[important:...]`) unrecognized because the FIRST bracket seen was the timestamp,
 * not the tag (2026-07-10). Shared with level-classifier.ts's database patterns and
 * their webview mirror (viewer-level-classify.ts) so all three stay in sync.
 */
export const savedLogWrapperPatternSrc = '(?:\\[\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\]\\s*\\[[^\\]]+\\]\\s*)?';

/**
 * Head bracket tag at line start, tolerating the same optional shells as
 * `databaseBracketTagPattern` in level-classifier.ts (saved-log `[time] [source]`
 * wrapper, logcat prefix, threadtime prefix, Flutter `[log]` wrapper). Captures the
 * first `[...]` tag's inner text (group 1), which may include a `:metadata` suffix —
 * callers split on the first colon.
 *
 * Anchored to line start so a mid-message `see [db] for details` does not promote.
 */
export const headBracketTagPattern = new RegExp(
    '^' + savedLogWrapperPatternSrc
    + '(?:[VDIWEFA]\\/[^:]*:\\s*)?'                                                      // optional logcat prefix
    + '(?:\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+[VDIWEFA]\\s+[^:]*:\\s*)?' // optional threadtime
    + '(?:\\[log\\]\\s*)?'                                                              // optional Flutter [log] shell
    + '\\[([^\\]]+)\\]',                                                                // first bracket tag (inner = group 1)
);

/** Tag name = substring before the first colon, trimmed and lowercased. `[db:phase 2]` → `db`. */
export function tagNameBeforeColon(rawTag: string): string {
    const colon = rawTag.indexOf(':');
    const name = colon === -1 ? rawTag : rawTag.slice(0, colon);
    return name.trim().toLowerCase();
}

/** Resolve a tag name to its mapped level, or null when unrecognized. */
export function lookupTagLevel(tagName: string): SeverityLevel | null {
    return TAG_LEVEL_MAP[tagName.toLowerCase()] ?? null;
}

/**
 * Level implied by an explicit head bracket tag, or null when the line has no
 * recognized head tag. Splits `[TAG:metadata]` on the first colon so the metadata
 * does not affect the lookup.
 */
export function matchesTagLevel(plainText: string): SeverityLevel | null {
    const m = headBracketTagPattern.exec(plainText);
    if (!m?.[1]) { return null; }
    return lookupTagLevel(tagNameBeforeColon(m[1]));
}

/** Serialized map for injection into the webview classifier template (it cannot import). */
export function tagLevelMapJson(): string {
    return JSON.stringify(TAG_LEVEL_MAP);
}
