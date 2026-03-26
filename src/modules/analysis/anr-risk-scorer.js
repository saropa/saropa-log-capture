"use strict";
/**
 * Pre-production ANR risk scoring.
 *
 * Scans debug session body text for patterns that predict ANRs
 * (choreographer warnings, GC pauses, jank, dropped frames, ANR keywords)
 * and produces a 0-100 risk score with human-readable signal descriptions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanAnrRisk = scanAnrRisk;
const signalDefs = [
    { pattern: /\b(?:anr|application\s+not\s+responding|input\s+dispatching\s+timed\s+out)\b/i, label: 'ANR keyword', weight: 25, cap: 50 },
    { pattern: /\bchoreographer\b/i, label: 'Choreographer warning', weight: 5, cap: 30 },
    { pattern: /\bgc\s+pause\b/i, label: 'GC pause', weight: 8, cap: 30 },
    { pattern: /\b(?:dropped\s+frame|skipped\s+\d+\s+frames?)\b/i, label: 'Dropped frame', weight: 3, cap: 20 },
    { pattern: /\b(?:jank|stutter|doing\s+too\s+much\s+work)\b/i, label: 'Jank indicator', weight: 10, cap: 30 },
];
/** Scan session body text and compute an ANR risk score. */
function scanAnrRisk(bodyText) {
    const lines = bodyText.split('\n');
    const signals = [];
    let total = 0;
    for (const def of signalDefs) {
        const count = countMatches(lines, def.pattern);
        if (count === 0) {
            continue;
        }
        const points = Math.min(count * def.weight, def.cap);
        total += points;
        signals.push(`${count} ${def.label}${count !== 1 ? 's' : ''}`);
    }
    const score = Math.min(total, 100);
    return { score, level: scoreToLevel(score), signals };
}
function countMatches(lines, pattern) {
    let count = 0;
    for (const line of lines) {
        if (pattern.test(line)) {
            count++;
        }
    }
    return count;
}
function scoreToLevel(score) {
    if (score > 50) {
        return 'high';
    }
    if (score > 20) {
        return 'medium';
    }
    return 'low';
}
//# sourceMappingURL=anr-risk-scorer.js.map