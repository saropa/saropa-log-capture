# Ecosystem Knowledge Files

Catalog of project folders and files that contain indexable knowledge, organized by ecosystem. Used by the project indexer (see `PLAN_PROJECT_INDEXER.md`) to inform default scan sources and guide future file-type support.

**Current indexer support:** `.md`, `.txt` (content tokenization).
**Planned:** Ecosystem-specific parsers for config files (YAML, JSON, XML, TOML).

---

## Universal (All Ecosystems)

Folders and files found in nearly every software project.

### Folders

| Folder | Purpose | File Types | Notes |
|--------|---------|------------|-------|
| `docs/` | Primary documentation | `.md`, `.txt`, `.rst`, `.adoc` | Most common doc folder name |
| `doc/` | Documentation (singular) | `.md`, `.txt`, `.rst`, `.rdoc` | Ruby, Python, Java, C/C++ convention |
| `bugs/` | Internal issue tracking | `.md`, `.txt` | Project-local bug reports |
| `.github/` | GitHub config & templates | `.md`, `.yml`, `.yaml` | Issue templates, PR templates, CONTRIBUTING, CODEOWNERS, SECURITY |
| `adr/` | Architecture Decision Records | `.md` | Numbered decision docs (e.g. `0001-use-postgres.md`) |
| `rfcs/` | Request for Comments / proposals | `.md` | Design proposals before implementation |
| `design/` | Design specs | `.md`, `.txt` | Wireframes descriptions, API contracts |
| `wiki/` | Knowledge base | `.md` | Often synced with GitHub wiki |
| `guides/` | How-to guides | `.md` | Setup guides, contribution guides |
| `notes/` | Developer notes | `.md`, `.txt` | Informal project notes |
| `specs/` | Specifications | `.md`, `.yaml`, `.json` | API specs (OpenAPI), test specs |
| `plans/` | Project plans | `.md` | Roadmaps, iteration plans |

### Root Files

| File | Purpose | Notes |
|------|---------|-------|
| `README.md` | Project overview | Nearly universal |
| `CHANGELOG.md` | Version history | Semantic versioning notes |
| `CONTRIBUTING.md` | Contribution guide | Often at root or in `.github/` |
| `LICENSE` / `LICENSE.md` | License text | Low indexing value but common |
| `SECURITY.md` | Security policy | Vulnerability reporting process |
| `CODE_OF_CONDUCT.md` | Community guidelines | Common in open source |
| `ARCHITECTURE.md` | High-level architecture | Growing convention |
| `.editorconfig` | Editor settings | Low indexing value |

---

## Flutter / Dart

Primary focus for initial release. Flutter projects have a distinctive structure with platform-specific subdirectories.

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `pubspec.yaml` | Dependencies, metadata, assets | YAML | **High** — package names, versions, descriptions |
| `pubspec.lock` | Resolved dependency tree | YAML | Medium — exact versions for environment diff |
| `analysis_options.yaml` | Lint rules, analyzer config | YAML | Medium — active lint rules explain warnings |
| `dart_test.yaml` | Test configuration | YAML | Low |
| `.metadata` | Flutter SDK metadata | Text | Low — SDK version |
| `firebase.json` | Firebase project config | JSON | **High** — hosting, functions, firestore rules paths |
| `.firebaserc` | Firebase project aliases | JSON | Medium — project ID mapping |

### Platform Directories

| Directory | Platform | Key Files | File Types | Indexing Value |
|-----------|----------|-----------|------------|---------------|
| `android/` | Android | `build.gradle`, `build.gradle.kts`, `AndroidManifest.xml`, `google-services.json` | Groovy, Kotlin DSL, XML, JSON | **High** — package name, permissions, Firebase config |
| `android/app/` | Android app | `build.gradle`, `proguard-rules.pro` | Groovy, Text | Medium — minSdk, targetSdk, signing |
| `ios/` | iOS | `Info.plist`, `Podfile`, `Podfile.lock` | XML plist, Ruby, Text | **High** — bundle ID, permissions, pod versions |
| `ios/Runner/` | iOS app | `Info.plist`, `*.entitlements` | XML plist | Medium — capabilities, URL schemes |
| `web/` | Web | `index.html`, `manifest.json` | HTML, JSON | Low |
| `linux/`, `macos/`, `windows/` | Desktop | `CMakeLists.txt`, various | CMake, C++ | Low |

### Configuration & CI

| File / Folder | Purpose | File Type | Indexing Value |
|---------------|---------|-----------|---------------|
| `.github/workflows/` | CI/CD pipelines | `.yml`, `.yaml` | Medium — build steps, test commands |
| `.vscode/` | VS Code workspace settings | `.json` | Low — launch configs, settings |
| `Makefile` | Build automation | Makefile | Low |
| `build.yaml` | Build runner config (code gen) | YAML | Medium — generator settings |
| `mason.yaml` | Mason brick templates | YAML | Low |

### Localization

| File / Folder | Purpose | File Type | Indexing Value |
|---------------|---------|-----------|---------------|
| `l10n/` | Localization config | `.yaml` | Low |
| `lib/l10n/` | ARB translation files | `.arb` (JSON) | Medium — user-facing strings, error messages |
| `l10n.yaml` | Localization generator config | YAML | Low |

### Dart-Specific Knowledge

| File / Folder | Purpose | File Type | Indexing Value |
|---------------|---------|-----------|---------------|
| `lib/` | App source code | `.dart` | Not for content indexing — source linker handles these |
| `test/` | Unit/widget tests | `.dart` | Not for content indexing |
| `integration_test/` | Integration tests | `.dart` | Not for content indexing |
| `.dart_tool/` | Generated / cache | Various | **Skip** — generated, large, no knowledge value |
| `build/` | Build output | Various | **Skip** — generated |

### Firebase-Specific (Flutter + Firebase)

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `google-services.json` | Android Firebase config | JSON | **High** — project ID, app ID, API keys |
| `GoogleService-Info.plist` | iOS Firebase config | XML plist | **High** — same as above for iOS |
| `firebase_options.dart` | Generated Firebase config | Dart | Medium — generated but contains project config |
| `firestore.rules` | Firestore security rules | Rules DSL | **High** — access patterns, collection names |
| `storage.rules` | Storage security rules | Rules DSL | Medium |
| `database.rules.json` | Realtime DB rules | JSON | Medium |
| `firestore.indexes.json` | Composite indexes | JSON | Medium — indexed fields indicate query patterns |
| `firebase_app_id_file.json` | App ID for Crashlytics | JSON | Low |

---

## Node.js / TypeScript

For reference — many Flutter projects have companion backends or tooling in Node.

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `package.json` | Dependencies, scripts, metadata | JSON | **High** — dependency names, script commands |
| `package-lock.json` / `yarn.lock` | Resolved tree | JSON / Text | Low — too large, low signal |
| `tsconfig.json` | TypeScript config | JSON | Medium — paths, strict mode |
| `.eslintrc.*` / `eslint.config.*` | Lint rules | JSON / JS | Medium |
| `.prettierrc` | Formatting config | JSON / YAML | Low |
| `jest.config.*` | Test config | JS / JSON | Low |

### Folders

| Folder | Purpose | File Types | Notes |
|--------|---------|------------|-------|
| `src/` | Source code | `.ts`, `.js` | Not for content indexing — source linker handles |
| `scripts/` | Build/dev scripts | `.sh`, `.js`, `.ts` | Low indexing value |
| `config/` | App configuration | `.json`, `.yaml`, `.env.example` | Medium — env var names, feature flags |

---

## Python

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `pyproject.toml` | Modern project config | TOML | **High** — dependencies, project metadata |
| `setup.py` / `setup.cfg` | Legacy project config | Python / INI | Medium |
| `requirements.txt` | Dependencies | Text | Medium — package names and versions |
| `Pipfile` / `Pipfile.lock` | Pipenv dependencies | TOML / JSON | Medium |
| `tox.ini` | Test matrix config | INI | Low |
| `.flake8` / `pyproject.toml [tool.ruff]` | Linting config | INI / TOML | Low |

---

## Go

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `go.mod` | Module definition + dependencies | Text | **High** — module path, dependency names |
| `go.sum` | Dependency checksums | Text | Low — too noisy |
| `Makefile` | Build automation | Makefile | Medium — build commands |

---

## Rust

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `Cargo.toml` | Package config + dependencies | TOML | **High** — crate names, features |
| `Cargo.lock` | Resolved dependency tree | TOML | Low — too large |
| `rust-toolchain.toml` | Rust version | TOML | Low |
| `clippy.toml` | Linter config | TOML | Low |

---

## Java / Kotlin / Android (non-Flutter)

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `build.gradle` / `build.gradle.kts` | Build config | Groovy / Kotlin DSL | **High** — dependencies, plugins |
| `settings.gradle` / `settings.gradle.kts` | Multi-module structure | Groovy / Kotlin DSL | Medium |
| `pom.xml` | Maven dependencies | XML | **High** — artifact IDs, versions |
| `gradle.properties` | Build properties | Properties | Medium — versions, feature flags |

---

## Swift / iOS (non-Flutter)

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `Package.swift` | Swift Package Manager | Swift | **High** — dependencies, targets |
| `Podfile` | CocoaPods dependencies | Ruby | **High** — pod names, versions |
| `*.xcodeproj` / `*.xcworkspace` | Xcode project | Binary / XML | **Skip** — binary format, not indexable |
| `Info.plist` | App metadata | XML plist | **High** — permissions, capabilities |

---

## Implementation Priority

For the project indexer's initial release, support is tiered:

### Tier 1 — Ship with v1 (content tokenization)

File types with straightforward text parsing:

| Extension | Parser | Ecosystems |
|-----------|--------|------------|
| `.md` | Markdown-aware (headings, code blocks, bold) | All |
| `.txt` | Whitespace-split | All |

### Tier 2 — Fast follow (structured parsing)

Config files where key-value extraction adds real value:

| Extension | Parser | Key extraction | Ecosystems |
|-----------|--------|----------------|------------|
| `.yaml` / `.yml` | YAML keys + string values | Dependency names, rule IDs, config keys | Flutter, GitHub, Python, Rust |
| `.json` | JSON keys + string values | Package names, script names, config values | Node.js, Flutter, Firebase |
| `.toml` | TOML keys + string values | Crate names, Python packages, config | Rust, Python |

### Tier 3 — Future (specialized parsers)

Files needing ecosystem-specific parsing logic:

| Extension | Parser | What to extract | Ecosystems |
|-----------|--------|-----------------|------------|
| `.gradle` / `.gradle.kts` | Dependency declaration regex | Artifact IDs, versions | Android, Java |
| `.xml` (plist, manifest) | XML element/attribute extraction | Permissions, bundle IDs, package names | iOS, Android |
| `.arb` | JSON with ICU message syntax | User-facing strings, error message templates | Flutter l10n |
| `.rules` | Firebase rules DSL | Collection names, access patterns | Firebase |
| `.rst` | reStructuredText headings + directives | Same as markdown | Python (Sphinx) |
| `.adoc` | AsciiDoc headings | Same as markdown | Java, enterprise |
| `.rdoc` | RDoc format | Same as markdown | Ruby |

---

## Folder Scan Safety

Some folders must **never** be scanned regardless of user configuration:

| Folder | Reason |
|--------|--------|
| `node_modules/` | Too large, third-party code |
| `.dart_tool/` | Generated, large |
| `build/` / `dist/` / `out/` | Build output |
| `.git/` | Git internals |
| `vendor/` | Vendored dependencies (Go, PHP, Ruby) |
| `__pycache__/` | Python bytecode cache |
| `target/` | Rust/Java build output |
| `.gradle/` | Gradle cache |
| `Pods/` | CocoaPods (iOS) |
| `.pub-cache/` | Dart package cache |

The indexer should maintain a hardcoded blocklist of these patterns, applied before any user-configured sources are scanned.
