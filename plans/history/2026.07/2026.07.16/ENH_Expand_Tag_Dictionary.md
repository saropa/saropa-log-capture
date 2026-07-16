Status: Fixed

1. Add new mappings
lowmemorykiller => Low Memory Killer

2. the tooltip needs to comma separate tags - ![alt text](image.png)

## Finish Report (2026-07-16)

Two refinements to the log viewer's tag column.

**1. Tag display-label overrides.** Chip labels are produced algorithmically by
`formatTagLabel` (camelCase split, separator-to-space, acronym preservation) in
`src/ui/viewer-bracket-head-tags/viewer-bracket-head-tags.ts`. All-lowercase Android
system tags with no internal boundary (`lowmemorykiller`, `dalvikvm`, `mediacodec`, …)
rendered as one run-together word ("Lowmemorykiller"). A new `TAG_LABEL_OVERRIDES`
table, consulted first inside `formatTagLabel`, maps a dozen such tags to explicit
labels. Keyed on the lowercased raw tag, so the override normalizes the chip regardless
of the casing the log source emits, and the label reads identically on the row chip, the
Message Tags sidebar, and the JSON export (all three share `formatTagLabel`). Two
categories: all-lowercase compounds (`lowmemorykiller` → "Low Memory Killer",
`dalvikvm` → "Dalvik VM", `surfaceflinger`, `bufferqueue`, `audioflinger`, `audiotrack`,
`mediacodec`, `mediaplayer`, `cameraservice`, `inputmethodmanager`) and
acronym/proper-name casing fixes (`wpa_supplicant` → "WPA Supplicant", `libc`).

**2. Tag-cell tooltip delimiter.** `headTagsTitle` — the full tag list on the tag cell's
hover title, the only place a line's second/third tag is visible now that only the
primary tag renders as a chip — joined names with a single space, so a multi-tag line
read as one phrase ("Perf Frame Stall Flutter"). Changed to ", " so the distinct tags
are unambiguous ("Perf, Frame Stall, Flutter").

**Defect caught in review.** The first override implementation indexed the plain object
directly (`TAG_LABEL_OVERRIDES[key]`). Because `formatTagLabel` runs on
attacker/developer-controlled source-tag names, a tag literally named `constructor` or
`__proto__` resolved to an inherited `Object.prototype` member and would have rendered
the function source or "[object Object]" as the label. Guarded with
`Object.prototype.hasOwnProperty.call(...)` so only own entries resolve; prototype-named
tags fall through to the normal splitter. Not an XSS (every call site still escapes
after `formatTagLabel`), but a broken label. Test cases pin both the override behavior
and the prototype-key fall-through.

Verification: `npm run check-types` clean; `viewer-head-tag-cell.test.ts` 14 passing.
