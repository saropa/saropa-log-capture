# Translation Rollout Plan

**Extension:** Saropa Log Capture
**Date:** 2026-02-18
**Prerequisite:** Manifest localization via `package.nls.json` (implemented)

---

## 1. Overview

This plan covers adding locale-specific translation files (`package.nls.{locale}.json`) to ship translated command titles, setting descriptions, view names, and walkthrough content to non-English VS Code users.

**Current state:** 127 English strings extracted into `package.nls.json`. No translations exist yet.

**Goal:** Ship high-quality translations for the top 5 languages by VS Code Language Pack installs, prioritized by developer population and Flutter/mobile ecosystem overlap.

## 2. Language Priority

Based on VS Code Language Pack install data and relevance to the mobile developer audience:

| Priority | Language | NLS filename | Rationale |
|----------|----------|-------------|-----------|
| 1 | Chinese (Simplified) | `package.nls.zh-cn.json` | ~48M Language Pack installs. Largest non-English VS Code user base. Strong Flutter adoption in China. |
| 2 | Japanese | `package.nls.ja.json` | Large developer market. High VS Code adoption. Significant mobile development community. |
| 3 | Korean | `package.nls.ko.json` | Strong mobile/Flutter ecosystem in South Korea. |
| 4 | Spanish | `package.nls.es.json` | ~11M Language Pack installs. Covers Spain + Latin America. |
| 5 | German | `package.nls.de.json` | Major European developer market. |

**Deferred:** French (`fr`), Portuguese-Brazil (`pt-br`), Russian (`ru`), Italian (`it`), Chinese Traditional (`zh-tw`), Turkish (`tr`), Polish (`pl`), Czech (`cs`). Add these if community demand emerges or the top 5 prove successful.

## 3. Translation Method

### Recommended: Machine Translation + Professional Review

1. **Draft** — Use a high-quality LLM or translation API to produce initial translations from the English `package.nls.json` source.
2. **Review** — Have a native-speaking developer review every string for technical accuracy, natural phrasing, and adherence to the rules in section 4.
3. **Ship** — Merge the reviewed file and run `npm run verify-nls` to confirm key alignment.

### Why not community translation?

- 127 strings is small enough for a single reviewer to handle in 1-2 hours.
- Community contributions risk inconsistent terminology and incomplete coverage.
- Professional review ensures the "complete coverage, no partial translations" rule (section 4.7 of the best practices doc) is met before shipping.

### Why not machine translation alone?

- Setting descriptions contain technical nuance (DAP, logcat, ANSI, regex syntax) that needs a developer's eye.
- Walkthrough descriptions have markdown formatting and command URIs that must be preserved exactly.
- A wrong translation in the Settings UI is worse than no translation — it actively misleads users.

## 4. Translation Rules

All translators must follow these rules (also documented in `docs/internationalization-best-practices.md`):

### 4.1 Do Not Translate

- **Brand name:** "Saropa Log Capture" stays in all locales, including the "Saropa Log Capture:" command prefix.
- **Technical terms in Latin script:** DAP, ANSI, stderr, stdout, CSV, JSON, JSONL, HTML, Debug Console, Activity Bar, webview, Crashlytics, Play Vitals, GCP, `.log`, `.gitignore`, `reports/`, regex patterns, code identifiers.
- **Numeric values and defaults:** 100000, 1000, 300, 3s, 10s, 30s, 40px, 60px, 90px.
- **Markdown syntax:** `**bold**`, backtick code, `[link text](command:...)` URIs. Translate the visible text inside links but never modify the URI.
- **Enum values:** "small", "medium", "large", "left", "right", "keyword", "line", etc. (These are setting values, not display text.)

### 4.2 Do Translate

- **Action verbs:** "Start", "Stop", "Pause", "Open", "Delete", "Export", "Copy", "Search", etc.
- **Descriptive text:** Setting descriptions explaining what a feature does.
- **Walkthrough prose:** Step titles and descriptions (preserving markdown and command URIs).
- **Enum descriptions:** "Last 24 hours", "Last 7 days", etc. (These are display text shown in the Settings UI dropdown.)

### 4.3 Examples

| English | Japanese (example) | Notes |
|---------|--------------------|-------|
| `Saropa Log Capture: Start Capture` | `Saropa Log Capture: キャプチャを開始` | Brand prefix preserved |
| `Directory for log files, relative to workspace root.` | `ログファイルのディレクトリ（ワークスペースルートからの相対パス）。` | Technical terms like "workspace root" may be translated if the VS Code Japanese UI uses a standard term |
| `DAP output categories to capture.` | `キャプチャするDAP出力カテゴリ。` | "DAP" stays in Latin script |
| `Last 7 days` | `過去7日間` | Number preserved, surrounding text translated |

## 5. Per-Language Workflow

For each language in priority order:

### Step 1: Generate Draft (30 min)

Copy `package.nls.json` to `package.nls.{locale}.json` and translate all 127 values using an LLM or translation service. Provide the translation rules from section 4 as context.

### Step 2: Technical Review (1-2 hours)

A native-speaking developer reviews every string for:
- Natural, idiomatic phrasing (not "translationese")
- Correct preservation of brand names, technical terms, markdown, and command URIs
- Consistency with VS Code's own UI terminology in that locale (check VS Code's language pack for reference terms)
- No missing or extra keys

### Step 3: Key Alignment Verification (2 min)

```bash
npm run verify-nls
```

Confirms the new locale file has exactly the same 127 keys as the English default.

### Step 4: Manual Testing (15 min)

1. Set VS Code locale: `Ctrl+Shift+P` > "Configure Display Language" > select the locale
2. Reload VS Code
3. Verify:
   - Command Palette shows translated command titles
   - Settings UI shows translated descriptions (including markdown rendering)
   - Walkthrough renders correctly with working command links
   - View names display correctly in the panel

### Step 5: Ship

- Add native-script keywords to `package.json` for Marketplace discoverability (e.g., `ログ`, `デバッグ` for Japanese)
- Update CHANGELOG.md
- Commit and release

## 6. Trigger Criteria

Start translation work when **any** of these conditions are met:

- **Install milestone:** Extension reaches 1,000 installs on the VS Code Marketplace.
- **User request:** A user or reviewer requests a specific language via GitHub issue.
- **Market expansion:** Saropa decides to target a specific geographic market for its product suite.
- **Community contribution:** A native speaker volunteers to review translations for a specific language.

**Do not** translate proactively before there is evidence of demand. The English-only nls infrastructure is complete and ready — translations can be added incrementally at any time without code changes.

## 7. Maintenance

### When Adding New Settings or Commands

After any change that adds strings to `package.json`:

1. Add the English value to `package.nls.json`
2. Add translations to **all** existing `package.nls.{locale}.json` files
3. Run `npm run verify-nls` to catch any missing keys
4. If a proper translation isn't immediately available, use the English value as a placeholder and open a tracking issue

### Keeping Translations Current

- `npm run verify-nls` catches missing and orphan keys across all locale files
- Consider adding `verify-nls` to the CI pipeline or `npm run compile` chain to prevent drift
- When a setting description changes in English, update all locale files (even if the translation needs re-review — the English fallback is worse than a slightly stale translation)

## 8. File Size Impact

Each locale file adds ~5 KB to the VSIX package (127 keys, ~4,500 characters of text). Five languages adds ~25 KB total — negligible impact on download size and extension load time.

## 9. Success Metrics

After shipping translations, track:

- **Marketplace reviews** mentioning localization (positive or negative)
- **GitHub issues** reporting translation errors
- **Install growth** in targeted regions (Marketplace analytics, if available)
- **Rating changes** after adding each language

## 10. References

- [VS Code Display Language Configuration](https://code.visualstudio.com/docs/getstarted/locales)
- [VS Code Localization Repository](https://github.com/microsoft/vscode-loc) — reference for standard UI terminology in each language
- [VS Code Marketplace Language Packs](https://marketplace.visualstudio.com/search?target=VSCode&category=Language+Packs&sortBy=Installs) — install count data
- [docs/internationalization-best-practices.md](internationalization-best-practices.md) — technical rules for nls files
