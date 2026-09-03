# Position-proxy test audit script

Test assertions in `src/test/ui/*.test.ts` that locate code via `script.indexOf('...')`
followed by an index comparison or a fixed-offset `.slice(i, i + N)` window are silently
vulnerable to `max-lines` extractions that move the referenced code to a different sibling
`getXyzScript()` file or reorder concatenation — the assertion still finds *a* match, but at
the wrong position, so the test passes or fails for the wrong reason. This is the exact defect
class fixed in commits `8cbefce3` and `cdf0555e` (four extraction-caused and pause-gate test
failures traced to stale positional assumptions, see `docs/handover/20260903_0949_*.md`).

## Change

Added `scripts/modules/verify/verify-script-position-proxies.mjs`, a standalone audit script
(not wired into `npm run compile` or `preflight`) that scans `src/test/ui/*.test.ts` for two
risk patterns and prints a review list, grouped by file and line:

- **ordering-by-index** — two or more `const x = script.indexOf(...)` results compared with
  `<`/`>`/`<=`/`>=` to assert one branch appears before another in the concatenated script.
- **fixed-offset window** — `.slice(anchor, anchor + <literal number>)` windows, whose true end
  drifts whenever code is added or removed between the anchor and the offset boundary.

Registered as `npm run verify:script-position-proxies` in `package.json`. A first run against
the current test suite found 56 matches across 25 files (`viewer-context-menu.test.ts` alone
accounts for 12). None of these are current failures — they are risk markers for reviewers to
revisit the next time a `getXyzScript()` file is split or reordered by a `max-lines` extraction.

## Verification

`node scripts/modules/verify/verify-script-position-proxies.mjs` and
`npm run verify:script-position-proxies` both run cleanly and print the same 56-finding report.
`/code-review low` on the new script: two low-severity, non-blocking findings noted and left
unfixed as disproportionate for an informational, non-gated audit tool — the order-detection
regex only recognizes `const`-declared index variables (matches this codebase's "const by
default" convention; `let`-declared or destructured index vars would be missed), and the script
has no try/catch around `readdirSync`, so it throws an unhandled `ENOENT` if invoked from
outside the repo root instead of an npm script (acceptable: it is only ever invoked via
`npm run verify:script-position-proxies` from the repo root).
