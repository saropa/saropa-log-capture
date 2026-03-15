# L4: OWASP Violations in Bug Reports

## Status: Specification

## Summary

When a runtime crash occurs and the crash file has OWASP-mapped lint violations, add a security context callout to the bug report:

> **Security context:** Crash file `auth_service.dart` has 2 OWASP violations — M1: Improper Credential Usage, M9: Insecure Data Storage

This connects runtime errors to security posture. A developer seeing this immediately knows the crash happened in code that has known security weaknesses — the crash may be a symptom of those weaknesses.

## End State

### New section: "Security Context" (after Known Lint Issues)

```markdown
## Security Context

Crash file `lib/services/auth_service.dart` has OWASP-mapped violations:

| Category | Count | Rules |
|----------|-------|-------|
| **M1: Improper Credential Usage** | 2 | avoid_hardcoded_credentials, require_secure_storage |
| **M9: Insecure Data Storage** | 1 | avoid_plaintext_sensitive_data |
| **A03: Injection** | 1 | sanitize_user_input |

3 of 4 OWASP violations are in the **primary crash file** (auth_service.dart:42).

> These violations may be related to the crash. Review the rules above for potential root causes.
```

### In the executive summary / Key Findings (when present)

```markdown
## Key Findings

- **Security:** Primary crash file has 4 OWASP violations (M1, M9, A03)
- **Recurrence:** This error has occurred in 3 previous sessions
- ...
```

### When no OWASP violations exist

Section is silently omitted. No "0 OWASP violations" noise.

## Data Source

Every violation in `violations.json` already has an `owasp` field:

```json
{
    "owasp": {
        "mobile": ["m1", "m9"],
        "web": ["a03"]
    }
}
```

The existing `LintViolation` interface in `lint-violation-reader.ts` already includes this:

```typescript
readonly owasp: { readonly mobile: readonly string[]; readonly web: readonly string[] };
```

The data is **already being read and returned** by `findLintMatches()`. It's just not being used in the report output. The current `formatTable()` in `bug-report-lint-section.ts` shows `impact` but not `owasp`.

## OWASP Category Labels

The full category labels for human-readable output:

```typescript
const OWASP_LABELS: Record<string, string> = {
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
```

## Proposed Changes

### 1. New module: `src/modules/bug-report/bug-report-owasp-section.ts` (~80 lines)

```typescript
import type { LintViolation } from '../misc/lint-violation-reader';

interface OwaspCategorySummary {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly rules: readonly string[];
}

/** Build OWASP category summaries from matched lint violations. */
function buildOwaspSummaries(matches: readonly LintViolation[]): OwaspCategorySummary[] {
    const categories = new Map<string, { count: number; rules: Set<string> }>();

    for (const v of matches) {
        const allCats = [...v.owasp.mobile, ...v.owasp.web];
        for (const cat of allCats) {
            const key = cat.toLowerCase();
            const entry = categories.get(key) ?? { count: 0, rules: new Set() };
            entry.count++;
            entry.rules.add(v.rule);
            categories.set(key, entry);
        }
    }

    const summaries: OwaspCategorySummary[] = [];
    for (const [id, entry] of categories) {
        summaries.push({
            id,
            label: OWASP_LABELS[id] ?? id.toUpperCase(),
            count: entry.count,
            rules: [...entry.rules].sort(),
        });
    }

    // Sort by count descending, then by ID.
    summaries.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    return summaries;
}

/** Format the Security Context section. Returns undefined if no OWASP violations. */
export function formatOwaspSection(
    matches: readonly LintViolation[],
    primaryFile?: string,
): string | undefined {
    const summaries = buildOwaspSummaries(matches);
    if (summaries.length === 0) return undefined;

    const totalOwaspViolations = summaries.reduce((s, c) => s + c.count, 0);

    const lines: string[] = ['## Security Context'];

    // Identify which file has the most OWASP violations.
    if (primaryFile) {
        const primaryMatches = matches.filter(
            v => v.file === primaryFile
                && (v.owasp.mobile.length > 0 || v.owasp.web.length > 0),
        );
        if (primaryMatches.length > 0) {
            const basename = primaryFile.split('/').pop() ?? primaryFile;
            lines.push(
                `Crash file \`${basename}\` has ${primaryMatches.length} ` +
                `OWASP-mapped violation${primaryMatches.length === 1 ? '' : 's'}:`,
            );
        } else {
            lines.push(
                `${totalOwaspViolations} OWASP-mapped violation${totalOwaspViolations === 1 ? '' : 's'} ` +
                `found in files appearing in this stack trace:`,
            );
        }
    } else {
        lines.push(
            `${totalOwaspViolations} OWASP-mapped violation${totalOwaspViolations === 1 ? '' : 's'} ` +
            `found in affected files:`,
        );
    }

    // Table of categories.
    lines.push('| Category | Count | Rules |');
    lines.push('|----------|-------|-------|');
    for (const s of summaries) {
        lines.push(`| **${s.label}** | ${s.count} | ${s.rules.join(', ')} |`);
    }

    // Callout.
    lines.push(
        '> These violations may be related to the crash. Review the rules above for potential root causes.',
    );

    return lines.join('\n\n');
}

/** One-liner for executive summary / Key Findings. Returns undefined if no OWASP violations. */
export function formatOwaspFinding(
    matches: readonly LintViolation[],
    primaryFile?: string,
): string | undefined {
    const summaries = buildOwaspSummaries(matches);
    if (summaries.length === 0) return undefined;

    const total = summaries.reduce((s, c) => s + c.count, 0);
    const ids = summaries.map(s => s.id.toUpperCase()).join(', ');
    const fileNote = primaryFile
        ? `Primary crash file has ${total} OWASP violation${total === 1 ? '' : 's'} (${ids})`
        : `Stack trace files have ${total} OWASP violation${total === 1 ? '' : 's'} (${ids})`;
    return `**Security:** ${fileNote}`;
}
```

### 2. Update `bug-report-formatter.ts`

Add the OWASP section after the lint section:

```typescript
import { formatOwaspSection } from './bug-report-owasp-section';

// In formatBugReport():
if (data.lintMatches?.matches.length) {
    sections.push(formatLintSection(data.lintMatches));
    // L4: OWASP context from matched lint violations.
    const owaspSection = formatOwaspSection(
        data.lintMatches.matches,
        data.primarySourcePath,
    );
    if (owaspSection) sections.push(owaspSection);
}
```

### 3. Update executive summary in `bug-report-sections.ts`

Add the OWASP finding to Key Findings when available:

```typescript
import { formatOwaspFinding } from './bug-report-owasp-section';

// In formatExecutiveSummary():
if (data.lintMatches?.matches.length) {
    const owaspFinding = formatOwaspFinding(
        data.lintMatches.matches,
        data.primarySourcePath,
    );
    if (owaspFinding) findings.push(owaspFinding);
}
```

### 4. No changes to `lint-violation-reader.ts`

The OWASP data is already parsed and returned on every `LintViolation`. No reader changes needed.

## Files Changed

| File | Change |
|------|--------|
| `src/modules/bug-report/bug-report-owasp-section.ts` | **New** — OWASP section formatter + finding one-liner (~80 lines) |
| `src/modules/bug-report/bug-report-formatter.ts` | Import and call `formatOwaspSection()` after lint section |
| `src/modules/bug-report/bug-report-sections.ts` | Import and call `formatOwaspFinding()` in executive summary |

## Edge Cases

| Case | Behavior |
|------|----------|
| No OWASP violations | Section silently omitted |
| OWASP violations but not in primary crash file | Table shown with "in affected files" phrasing |
| Violation maps to both mobile AND web OWASP | Both categories shown as separate rows |
| Same violation maps to multiple categories in same list | Each category counted independently |
| Unknown OWASP ID (future categories) | ID shown uppercase as-is (fallback label) |
| 50+ OWASP violations (large project) | All categories shown (no cap — there are only 20 possible OWASP categories total) |

## Tests

| Test | Description |
|------|-------------|
| `buildOwaspSummaries` basic | 3 violations with M1, M9, A03 → 3 summaries sorted by count |
| `buildOwaspSummaries` dedup rules | Same rule in 2 violations → rule listed once per category |
| `buildOwaspSummaries` no owasp | All violations have empty owasp → empty array |
| `buildOwaspSummaries` multi-category | Violation with `mobile: [m1, m9]` counted under both |
| `formatOwaspSection` with primary file | Shows "Crash file `auth.dart`" phrasing |
| `formatOwaspSection` without primary file | Shows "in affected files" phrasing |
| `formatOwaspSection` returns undefined when no owasp | No section rendered |
| `formatOwaspFinding` one-liner | Produces "Security: Primary crash file has N OWASP violations (M1, M9)" |
| `formatOwaspFinding` no primary | Uses "Stack trace files" phrasing |
| Integration: full report with OWASP | OWASP section appears after lint section in formatted report |

## Estimated Size

~80 lines new module + ~10 lines modifications across 2 files. 10 test cases.

## Dependencies

- Existing lint integration (`lint-violation-reader.ts`) — already reads OWASP data.
- L1 and L3 are independent — can be implemented in any order.

## Why This Matters

No other Dart tool connects runtime crashes to OWASP security categories. When a crash report says "this file has M9 (Insecure Data Storage) violations," the developer immediately understands the security implications of the bug — not just "something crashed" but "something crashed in code with known security weaknesses." This is unique to the Saropa ecosystem and directly valuable for regulated teams, security audits, and app store submissions.
