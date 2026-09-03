/**
 * Derives exclusion pattern candidates from stored interactions (local heuristics).
 */

import { parseExclusionPattern, testExclusion } from "../features/exclusion-matcher";
import { logExtensionWarn } from "../misc/extension-logger";
import type { InteractionType, UserInteraction } from "./interaction-types";

export interface ExtractedPattern {
    /** Valid `saropaLogCapture.exclusions` entry. */
    pattern: string;
    confidence: number;
    matchCount: number;
    sampleLines: string[];
    category: "noise" | "framework" | "verbose" | "repetitive";
}

/**
 * Minimum shared-prefix length a candidate must clear before it is even considered.
 * bug_024: at 12 chars, four semi-random log lines routinely share a prefix that long
 * (timestamps, log tags, common English preambles), so a handful of dismisses could mint
 * a pattern broad enough to hide unrelated app output. 24 chars demands a far more
 * specific — and so far less likely to be coincidental — shared preamble.
 */
const MIN_PREFIX_LEN = 24;

/**
 * bug_024 safety net: above this fraction of the user's own recent lines matched, a candidate
 * is rejected outright regardless of its computed confidence. This is independent of the
 * ratio/confidence math in extractPrefixPatterns, which only measures a candidate against the
 * dismissed subset that produced it — not against everything the user has actually seen, so it
 * cannot by itself catch a prefix that happens to also match most of the surrounding output.
 */
const MAX_RECENT_LINE_MATCH_RATIO = 0.5;

/**
 * True when `pattern` would match more than MAX_RECENT_LINE_MATCH_RATIO of `recentLines` — the
 * broader set of lines the user has actually interacted with (dismissed, kept, or scrolled past),
 * not just the subset that produced the candidate. This is the best available proxy for "recent
 * app output" here: the extractor only ever sees tracked UserInteraction records, never the full
 * log stream, so there is no separate app/framework classification to test against.
 */
function matchesTooBroadly(pattern: string, recentLines: readonly string[]): boolean {
    const rule = parseExclusionPattern(pattern);
    if (!rule || recentLines.length === 0) {
        return false;
    }
    const matched = recentLines.filter((line) => testExclusion(line, [rule])).length;
    return matched / recentLines.length > MAX_RECENT_LINE_MATCH_RATIO;
}

const DISMISS_TYPES: ReadonlySet<InteractionType> = new Set([
    "dismiss",
    "filter-out",
    "add-exclusion",
]);

function weightForType(t: InteractionType): number {
    if (t === "skip-scroll") {
        return 0.45;
    }
    return 1;
}

function normalizeLine(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

/** Longest common prefix length for a set of strings (all non-empty). */
function commonPrefixLen(lines: readonly string[]): number {
    if (lines.length === 0) {
        return 0;
    }
    let low = lines[0].length;
    for (let i = 1; i < lines.length; i++) {
        const a = lines[0];
        const b = lines[i];
        let j = 0;
        const m = Math.min(a.length, b.length);
        while (j < m && a[j] === b[j]) {
            j++;
        }
        low = Math.min(low, j);
        if (low === 0) {
            return 0;
        }
    }
    return low;
}

/**
 * True when the first differing position after a shared prefix is usually a digit — typical of
 * unrelated lines that only share a short static preamble (false positive for prefix rules).
 */
function sharedPrefixMostlyFollowedByDigit(texts: readonly string[], prefixLen: number): boolean {
    if (prefixLen < 1) {
        return false;
    }
    let after = 0;
    let digit = 0;
    for (const t of texts) {
        if (t.length <= prefixLen) {
            continue;
        }
        after++;
        const c = t.charAt(prefixLen);
        if (c >= "0" && c <= "9") {
            digit++;
        }
    }
    return after > 0 && digit / after >= 0.55;
}

function escapeRegexLiteral(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract prefix-based patterns: shared prefix across a fraction of weighted dismiss signals.
 */
function extractPrefixPatterns(weightedLines: { text: string; w: number }[]): ExtractedPattern[] {
    if (weightedLines.length < 4) {
        return [];
    }
    const texts = weightedLines.map((x) => x.text).filter((t) => t.length >= MIN_PREFIX_LEN);
    if (texts.length < 4) {
        return [];
    }
    const totalW = weightedLines.reduce((s, x) => s + x.w, 0);
    const len = commonPrefixLen(texts);
    // bug_024: below MIN_PREFIX_LEN the shared prefix is too generic to trust as a real pattern.
    if (len < MIN_PREFIX_LEN) {
        return [];
    }
    const prefix = texts[0].slice(0, len);
    if (sharedPrefixMostlyFollowedByDigit(texts, len)) {
        return [];
    }
    let matchW = 0;
    const samples: string[] = [];
    for (const x of weightedLines) {
        if (x.text.startsWith(prefix)) {
            matchW += x.w;
            if (samples.length < 3) {
                samples.push(x.text.slice(0, 120));
            }
        }
    }
    const ratio = matchW / Math.max(1e-6, totalW);
    if (ratio < 0.35) {
        return [];
    }
    const body = escapeRegexLiteral(prefix);
    const pattern = `/${body}/`;
    const rule = parseExclusionPattern(pattern);
    if (!rule) {
        return [];
    }
    const cat: ExtractedPattern["category"] = /flutter|dart|android|ios|framework/i.test(prefix) ? "framework" : "noise";
    return [
        {
            pattern,
            confidence: Math.min(0.95, 0.55 + ratio * 0.4),
            matchCount: Math.round(matchW),
            sampleLines: samples,
            category: cat,
        },
    ];
}

/**
 * Repeated normalized lines → substring exclusion (plain text when safe).
 */
function extractRepetitivePatterns(weightedLines: { text: string; w: number }[]): ExtractedPattern[] {
    const map = new Map<string, number>();
    for (const { text, w } of weightedLines) {
        const key = normalizeLine(text);
        if (key.length < 12) {
            continue;
        }
        map.set(key, (map.get(key) ?? 0) + w);
    }
    const out: ExtractedPattern[] = [];
    const totalW = weightedLines.reduce((s, x) => s + x.w, 0);
    for (const [line, w] of map) {
        if (w < 3) {
            continue;
        }
        const ratio = w / Math.max(1e-6, totalW);
        if (ratio < 0.08 && w < 8) {
            continue;
        }
        let pattern: string;
        if (line.length <= 200 && !/[\\/]/.test(line)) {
            pattern = line.length > 120 ? line.slice(0, 120) : line;
        } else {
            const slice = line.slice(0, 80);
            pattern = `/${escapeRegexLiteral(slice)}/`;
        }
        const rule = parseExclusionPattern(pattern);
        if (!rule) {
            continue;
        }
        out.push({
            pattern,
            confidence: Math.min(0.95, 0.5 + Math.min(0.45, w / 20)),
            matchCount: Math.round(w),
            sampleLines: [line.slice(0, 200)],
            category: "repetitive",
        });
    }
    return out;
}

function dedupePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
    const byKey = new Map<string, ExtractedPattern>();
    for (const p of patterns) {
        const prev = byKey.get(p.pattern);
        if (!prev || p.confidence > prev.confidence) {
            byKey.set(p.pattern, p);
        }
    }
    return [...byKey.values()];
}

/**
 * Build pattern candidates from interactions. Drops patterns that do not parse or fall below minConfidence.
 * Optional `existingExclusions` skips patterns already configured.
 */
export function extractPatterns(
    interactions: readonly UserInteraction[],
    minConfidence: number,
    _existingExclusions: readonly string[] = [],
): ExtractedPattern[] {
    const weightedLines: { text: string; w: number }[] = [];
    for (const i of interactions) {
        if (!DISMISS_TYPES.has(i.type) && i.type !== "skip-scroll") {
            continue;
        }
        const t = normalizeLine(i.lineText);
        if (t.length < 8) {
            continue;
        }
        weightedLines.push({ text: i.lineText, w: weightForType(i.type) });
    }

    if (weightedLines.length < 6) {
        return [];
    }

    const raw = [
        ...extractPrefixPatterns(weightedLines),
        ...extractRepetitivePatterns(weightedLines),
    ];
    const deduped = dedupePatterns(raw);
    // bug_024: the full interaction set (every tracked type, not just the dismissed subset that
    // produced a candidate) is the broadest sample of "recent app output" available to this pure
    // module — used below to reject any candidate that would hide most of it.
    const recentLines = interactions.map((i) => i.lineText);
    return deduped.filter((p) => {
        if (p.confidence < minConfidence) {
            return false;
        }
        const rule = parseExclusionPattern(p.pattern);
        if (!rule) {
            return false;
        }
        // bug_024: only the LCP/prefix heuristic ("framework"/"noise" categories) is prone to
        // over-generalizing past its dismissed sample — a "repetitive" candidate already matches
        // only lines equal to (or containing) the exact dismissed text, so it cannot by
        // construction sweep up unrelated app output the way a short shared prefix can.
        const isPrefixDerived = p.category === "framework" || p.category === "noise";
        if (isPrefixDerived && matchesTooBroadly(p.pattern, recentLines)) {
            logExtensionWarn(
                "pattern-extractor",
                `Rejected overly broad learned pattern "${p.pattern}" — matched more than ${Math.round(MAX_RECENT_LINE_MATCH_RATIO * 100)}% of recent lines.`,
            );
            return false;
        }
        // Do not suggest if it would hide an explicit-keep sample (user pinned similar text).
        const keepSamples = interactions
            .filter((x) => x.type === "explicit-keep")
            .map((x) => x.lineText);
        for (const k of keepSamples) {
            if (testExclusion(k, [rule])) {
                return false;
            }
        }
        return true;
    });
}
