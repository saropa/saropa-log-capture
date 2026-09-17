/**
 * Marker-bounded log reading for `getSignalDelta` (PLAN 119 /
 * bugs/119_plan-run-scoped-signal-correlation-api.md).
 *
 * Split out of `api-signal-delta.ts` so the boundary math — the highest-risk part of the feature,
 * where an off-by-one silently misattributes signals across a marker or a file split — sits behind
 * an injectable {@link PartReader} and can be pinned with plain `node:test` cases using an
 * in-memory fake, independent of the real `vscode.workspace.fs`-backed reader used at runtime
 * (see `src/test/api/signal-delta.test.ts`).
 *
 * Every read here is bounded. `getSignalDelta` is documented as a never-cached, call-as-often-as-
 * you-like read, so an unbounded "whole session into a string array" read would spike the
 * extension host on exactly the sessions it is most useful for — the same blowup the 25 MiB
 * ceiling in `api-daily-summary-build.ts` exists to prevent on the sibling API.
 */

import * as vscode from 'vscode';
import { getPartFileName } from './modules/capture/log-session-split';
import { logExtensionWarn } from './modules/misc/extension-logger';

/** A position within a session's (possibly multi-part) log file. */
export interface FileBound {
    readonly partNumber: number;
    /** Physical line index into that part (0-based; matches `LogSession.physicalLineCount`
     *  semantics — a counter of N written newlines is exactly index N in the split file). */
    readonly physicalLineIndex: number;
}

/** Reads one part's lines by part number, or `undefined` if that part can't be read. */
export type PartReader = (partNumber: number) => Promise<string[] | undefined>;

/**
 * Per-part read ceiling, mirroring `api-daily-summary-build.ts`'s `maxSeverityScanBytes`. A part
 * over this size is skipped with a warning rather than pulled into memory whole: `getSignalDelta`
 * is a foreground call on the extension host, and a caller may make one per command run.
 */
const maxPartBytes = 25 * 1024 * 1024;

/**
 * How many consecutive missing parts {@link findEndOfSessionBound} probes past before calling it
 * the end of the session. `readWindow` already treats a missing part as a gap to step over rather
 * than a hard stop (a part can be deleted or archived out from under a live session); this keeps
 * the two walkers on one policy instead of having an explicit window span a gap that an implicit
 * "now" bound would stop dead at.
 */
const maxMissingPartProbe = 3;

/** True for the "this part isn't there", which is the normal walked-past-the-end signal. */
function isFileNotFound(err: unknown): boolean {
    const code = (err as { code?: unknown } | undefined)?.code;
    return code === 'FileNotFound' || code === 'ENOENT';
}

/** Real, `vscode.workspace.fs`-backed {@link PartReader} for one session's parts on disk. */
export function diskPartReader(logDirUri: vscode.Uri, baseFileName: string): PartReader {
    return async (partNumber) => {
        const fileName = getPartFileName(baseFileName, partNumber);
        const uri = vscode.Uri.joinPath(logDirUri, fileName);
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > maxPartBytes) {
                logExtensionWarn('Signal delta', `${fileName}: ${stat.size} bytes exceeds the ${maxPartBytes}-byte read ceiling — part skipped.`);
                return undefined;
            }
            const raw = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(raw).toString('utf-8').split('\n');
        } catch (err) {
            // A part that simply isn't there is how both walkers detect the end of a session, so
            // it is expected and silent. Anything else (permissions, a truncated read) silently
            // shrinks the window, so it gets surfaced rather than swallowed.
            if (!isFileNotFound(err)) {
                logExtensionWarn('Signal delta', `${fileName}: could not be read (${err instanceof Error ? err.message : String(err)}) — part skipped.`);
            }
            return undefined;
        }
    };
}

/** Half-open `[start, end)` slice of one part's lines. */
interface LineRange {
    readonly start: number;
    readonly end: number;
}

/** Copy `source[range.start, range.end)` onto `target`, stopping at `maxLines` total. */
function appendBounded(target: string[], source: readonly string[], range: LineRange, maxLines: number): void {
    const { start, end } = range;
    // Deliberately a loop, not `target.push(...source.slice(start, end))`: spread-apply is bounded
    // by the call stack and throws RangeError somewhere north of ~125k arguments. `maxLines`
    // defaults to 100,000 COUNTED lines and deliberately excludes header/DAP/marker writes, so a
    // single real part can hold well past that many physical lines.
    //
    // `end` is clamped because a bound can legitimately name a line the file does not hold: the
    // live "now" bound comes from a counter incremented before the stream flushes. `slice` would
    // have clamped for free; an index loop happily appends `undefined` past the end instead.
    const last = Math.min(end, source.length);
    for (let i = start; i < last && target.length < maxLines; i++) {
        target.push(source[i]);
    }
}

/**
 * Read the lines in `[from, to)` across however many parts that spans. `from`/`to` are physical
 * line positions within their own part (see {@link FileBound}); parts strictly between them are
 * read in full. A part missing from disk (rotated/deleted) is skipped rather than failing the
 * whole read. Truncates at `maxLines`, keeping the EARLIEST lines — for the window after a marker
 * those are the ones closest to the bracketed command, which is what the caller asked about.
 */
export async function readWindow(reader: PartReader, from: FileBound, to: FileBound, maxLines: number): Promise<string[]> {
    if (to.partNumber < from.partNumber || (to.partNumber === from.partNumber && to.physicalLineIndex <= from.physicalLineIndex)) {
        return [];
    }
    const collected: string[] = [];
    for (let p = from.partNumber; p <= to.partNumber && collected.length < maxLines; p++) {
        const lines = await reader(p);
        if (lines === undefined) { continue; }
        const start = p === from.partNumber ? from.physicalLineIndex : 0;
        const end = p === to.partNumber ? to.physicalLineIndex : lines.length;
        appendBounded(collected, lines, { start, end: Math.max(start, end) }, maxLines);
    }
    return collected;
}

/**
 * Read up to `maxLines` of log immediately BEFORE `until`, walking parts backwards from it.
 *
 * Backwards is what makes the read bounded in I/O as well as memory: the "what did this session
 * already look like" baseline only needs recent history, so walking forward from part 0 would read
 * an entire multi-gigabyte session to throw nearly all of it away. Truncation therefore drops the
 * OLDEST lines, which is also the right bias — a signal from an hour ago says less about whether
 * the bracketed command introduced something than the minute before it does.
 */
export async function readHistory(reader: PartReader, until: FileBound, maxLines: number): Promise<string[]> {
    const chunks: string[][] = [];
    let remaining = maxLines;
    let consecutiveMisses = 0;
    for (let p = until.partNumber; p >= 0 && remaining > 0 && consecutiveMisses <= maxMissingPartProbe; p--) {
        const lines = await reader(p);
        // Same gap policy as the forward walkers: step over a hole, but stop rather than probe
        // every part back to zero. Retention deletes the OLDEST parts first, so a long run of
        // missing parts means that history is genuinely gone, not that it moved.
        if (lines === undefined) { consecutiveMisses++; continue; }
        consecutiveMisses = 0;
        const end = p === until.partNumber ? Math.min(until.physicalLineIndex, lines.length) : lines.length;
        if (end <= 0) { continue; }
        const slice = lines.slice(Math.max(0, end - remaining), end);
        chunks.push(slice);
        remaining -= slice.length;
    }
    // `flat()` rather than a spread push, for the same RangeError reason as `appendBounded`.
    return chunks.reverse().flat();
}

/**
 * Probe forward from `fromPart` for the last part that exists, and its line count — the "now"
 * bound for a session that has already ended. Steps over up to {@link maxMissingPartProbe}
 * consecutive missing parts so a hole in the middle doesn't read as the end of the session.
 */
export async function findEndOfSessionBound(reader: PartReader, fromPart: number): Promise<FileBound> {
    let last: FileBound = { partNumber: fromPart, physicalLineIndex: 0 };
    let consecutiveMisses = 0;
    for (let p = fromPart; consecutiveMisses <= maxMissingPartProbe; p++) {
        const lines = await reader(p);
        if (lines === undefined) { consecutiveMisses++; continue; }
        consecutiveMisses = 0;
        last = { partNumber: p, physicalLineIndex: lines.length };
    }
    return last;
}
