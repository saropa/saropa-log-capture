/**
 * OWASP security context section for bug reports.
 *
 * Surfaces OWASP-mapped lint violations in crash reports so developers
 * immediately see the security implications of runtime errors.
 */

import type { LintViolation } from '../misc/lint-violation-reader';

interface OwaspCategorySummary {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly rules: readonly string[];
}

/** OWASP category ID → human-readable label. */
const owaspLabels: Record<string, string> = {
    // Mobile Top 10 2024
    m1: 'M1: Improper Credential Usage',
    m2: 'M2: Inadequate Supply Chain Security',
    m3: 'M3: Insecure Authentication/Authorization',
    m4: 'M4: Insufficient Input/Output Validation',
    m5: 'M5: Insecure Communication',
    m6: 'M6: Inadequate Privacy Controls',
    m7: 'M7: Insufficient Binary Protections',
    m8: 'M8: Security Misconfiguration',
    m9: 'M9: Insecure Data Storage',
    m10: 'M10: Insufficient Cryptography',
    // Web Top 10 2021
    a01: 'A01: Broken Access Control',
    a02: 'A02: Cryptographic Failures',
    a03: 'A03: Injection',
    a04: 'A04: Insecure Design',
    a05: 'A05: Security Misconfiguration',
    a06: 'A06: Vulnerable and Outdated Components',
    a07: 'A07: Identification and Authentication Failures',
    a08: 'A08: Software and Data Integrity Failures',
    a09: 'A09: Security Logging and Monitoring Failures',
    a10: 'A10: Server-Side Request Forgery',
};

function hasOwasp(v: LintViolation): boolean {
    return v.owasp.mobile.length > 0 || v.owasp.web.length > 0;
}

/** Aggregate violations by OWASP category, sorted by count desc then ID. */
export function buildOwaspSummaries(
    matches: readonly LintViolation[],
): OwaspCategorySummary[] {
    const categories = new Map<string, { count: number; rules: Set<string> }>();

    for (const v of matches) {
        for (const cat of [...v.owasp.mobile, ...v.owasp.web]) {
            const key = cat.toLowerCase();
            const entry = categories.get(key) ?? { count: 0, rules: new Set<string>() };
            entry.count++;
            entry.rules.add(v.rule);
            categories.set(key, entry);
        }
    }

    const summaries: OwaspCategorySummary[] = [];
    for (const [id, entry] of categories) {
        summaries.push({
            id,
            label: owaspLabels[id] ?? id.toUpperCase(),
            count: entry.count,
            rules: [...entry.rules].sort(),
        });
    }

    summaries.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    return summaries;
}

/** Format the Security Context section. Returns undefined if no OWASP violations. */
export function formatOwaspSection(
    matches: readonly LintViolation[],
    primaryFile?: string,
): string | undefined {
    const summaries = buildOwaspSummaries(matches);
    if (summaries.length === 0) { return undefined; }

    const total = summaries.reduce((s, c) => s + c.count, 0);
    const lines: string[] = ['## Security Context'];

    if (primaryFile) {
        const primaryOwaspCount = matches.filter(
            v => v.file === primaryFile && hasOwasp(v),
        ).length;
        if (primaryOwaspCount > 0) {
            const basename = primaryFile.split('/').pop() ?? primaryFile;
            lines.push(
                `Crash file \`${basename}\` has ${primaryOwaspCount} ` +
                `OWASP-mapped violation${primaryOwaspCount === 1 ? '' : 's'}:`,
            );
        } else {
            lines.push(
                `${total} OWASP-mapped violation${total === 1 ? '' : 's'} ` +
                `found in files appearing in this stack trace:`,
            );
        }
    } else {
        lines.push(
            `${total} OWASP-mapped violation${total === 1 ? '' : 's'} ` +
            `found in affected files:`,
        );
    }

    const tableRows = summaries.map(
        s => `| **${s.label}** | ${s.count} | ${s.rules.join(', ')} |`,
    );
    lines.push(
        '| Category | Count | Rules |\n|----------|-------|-------|\n' +
        tableRows.join('\n'),
    );

    lines.push(
        '> These violations may be related to the crash. ' +
        'Review the rules above for potential root causes.',
    );

    return lines.join('\n\n');
}

/** Count OWASP violations and collect unique category IDs for scoring. */
export function countOwaspCategories(
    matches: readonly LintViolation[],
): { readonly owaspViolationCount: number; readonly owaspCategories: string } {
    const ids = new Set<string>();
    let count = 0;
    for (const v of matches) {
        if (!hasOwasp(v)) { continue; }
        count++;
        for (const c of v.owasp.mobile) { ids.add(c.toUpperCase()); }
        for (const c of v.owasp.web) { ids.add(c.toUpperCase()); }
    }
    return { owaspViolationCount: count, owaspCategories: [...ids].sort().join(', ') };
}
