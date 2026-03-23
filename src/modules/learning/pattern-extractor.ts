/**
 * Derives exclusion pattern candidates from stored interactions (local heuristics).
 */

import { parseExclusionPattern, testExclusion } from "../features/exclusion-matcher";
import type { InteractionType, UserInteraction } from "./interaction-types";

export interface ExtractedPattern {
    /** Valid `saropaLogCapture.exclusions` entry. */
    pattern: string;
    confidence: number;
    matchCount: number;
    sampleLines: string[];
    category: "noise" | "framework" | "verbose" | "repetitive";
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
    const texts = weightedLines.map((x) => x.text).filter((t) => t.length >= 12);
    if (texts.length < 4) {
        return [];
    }
    const totalW = weightedLines.reduce((s, x) => s + x.w, 0);
    const len = commonPrefixLen(texts);
    if (len < 12) {
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
    return deduped.filter((p) => {
        if (p.confidence < minConfidence) {
            return false;
        }
        const rule = parseExclusionPattern(p.pattern);
        if (!rule) {
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
