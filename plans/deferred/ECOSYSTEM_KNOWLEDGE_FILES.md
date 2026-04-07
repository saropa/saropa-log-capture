# Ecosystem Knowledge Files

Catalog of project folders and files that contain indexable knowledge, organized by ecosystem. Used by the project indexer (source: `src/modules/project-indexer/`) to inform default scan sources and guide file-type support.

**Supported file types:** `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.arb`, `.rules`, `.rst`, `.adoc`, `.gradle`, `.kts`, `.dart`, `.ini`, `.cfg`, `.conf`, `.properties`, `.env`, `.sql`, `.proto`, `.hcl`, `.tf`, `.tfvars`, `.csproj`, `.sln`, `.props`, `.targets`, `.mod`, `.mk`, `.sh`, `.ps1`, `.http`, `.rest`, `dockerfile`, `makefile`, `requirements`, `pipfile`.

---

## Universal (All Ecosystems)

Folders and files found in nearly every software project.

### Folders

| Folder | Purpose | File Types | Notes |
|--------|---------|------------|-------|
| `docs/` | Primary documentation | `.md`, `.txt`, `.rst`, `.adoc` | Most common doc folder name |
| `doc/` | Documentation (singular) | `.md`, `.txt`, `.rst` | Ruby, Python, Java, C/C++ convention |
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

Primary focus. Flutter projects have a distinctive structure with platform-specific subdirectories.

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

Many Flutter projects have companion backends or tooling in Node.

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
| `config/` | App configuration | `.json`, `.yaml`, `.env` | Medium — env var names, feature flags |

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
| `go.mod` | Module definition + dependencies | `.mod` | **High** — module path, dependency names (dedicated `go.mod` parser) |
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
| `pom.xml` | Maven dependencies | XML | **High** — artifact IDs, versions (dedicated `pom.xml` parser) |
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

## .NET / C#

### Project Root Files

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.csproj` | Project config + NuGet dependencies | XML (`.csproj`) | **High** — package references, target framework |
| `*.sln` | Solution structure | `.sln` | Medium — project layout |
| `Directory.Build.props` / `Directory.Build.targets` | Shared build properties | `.props` / `.targets` | Medium — centralised version management |

---

## Infrastructure / DevOps

### Terraform / HCL

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.tf` | Terraform config | HCL | **High** — resources, providers, variables |
| `*.tfvars` | Terraform variable values | HCL | Medium — environment-specific settings |
| `*.hcl` | Generic HCL config | HCL | Medium |

### Docker

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `Dockerfile` / `Dockerfile.*` | Container image definition | Dockerfile | **High** — base images, build steps, exposed ports |
| `docker-compose.yml` | Multi-container orchestration | YAML | **High** — services, networking, volumes |

### SQL

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.sql` | Database schemas, migrations | SQL | **High** — table/column names, constraints |

### Protocol Buffers

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.proto` | gRPC / Protobuf service definitions | Proto | **High** — message types, service methods |

### HTTP Requests

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.http` / `*.rest` | HTTP request collections | HTTP | Medium — API endpoints, headers |

### Shell / Scripts

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.sh` | Shell scripts | Shell | Low — build/deploy automation |
| `*.ps1` | PowerShell scripts | PowerShell | Low — Windows automation |
| `*.mk` | Makefile fragments | Makefile | Low |

### Key-Value Config

| File | Purpose | File Type | Indexing Value |
|------|---------|-----------|---------------|
| `*.ini` / `*.cfg` / `*.conf` | Configuration files | INI-style | Medium — settings, feature flags |
| `*.properties` | Java/Gradle properties | Properties | Medium — versions, config |
| `.env` / `.env.*` | Environment variables | Key-value | Medium — env var names (never index secrets) |

---

## Token Extraction Parsers

Each supported file type maps to a specialised parser. The dispatch logic lives in `project-indexer-file-types.ts:extractDocTokensByType()`.

| Parser | File Types | Extraction Strategy |
|--------|-----------|---------------------|
| Markdown | `.md` | Heading-aware, code blocks, bold — also extracts heading structure |
| JSON | `.json`, `Pipfile.lock` | Keys, key paths, string values |
| YAML | `.yaml`, `.yml` | Keys, key paths, scalar string values |
| TOML | `.toml`, `Pipfile` | Keys, table paths, string values |
| XML | `.xml` (generic) | Tag names, attributes, text values |
| pom.xml | `pom.xml` | Dedicated Maven artifact/version extraction |
| ARB | `.arb` | JSON-style keys, ICU message values |
| Rules | `.rules` | Match paths, allow clauses, body tokens |
| Structured text | `.rst`, `.adoc` | Heading-aware, prose tokens |
| Gradle | `.gradle`, `.gradle.kts` | Dependency/plugin focused extraction |
| SQL | `.sql` | Table/column names, constraints |
| Proto | `.proto` | Message types, service methods, fields |
| HCL | `.hcl`, `.tf`, `.tfvars` | Resource types, variable names, blocks |
| Go mod | `go.mod` | Module path, dependency names |
| .NET project | `.csproj`, `.sln`, `.props`, `.targets` | Package references, target frameworks |
| HTTP requests | `.http`, `.rest` | Methods, URLs, headers |
| Script text | `.mk`, `.sh`, `.ps1`, `Makefile` | Command and variable tokens |
| Requirements | `requirements.txt` | Package names, version specifiers |
| Key-value | `.ini`, `.cfg`, `.conf`, `.properties`, `.env*` | Key-value pairs |
| Dockerfile | `Dockerfile`, `Dockerfile.*` | Base images, commands, args |
| Plain text | fallback | Whitespace-split tokens |

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

The indexer maintains a hardcoded blocklist of these patterns in `project-indexer-file-types.ts`, applied before any user-configured sources are scanned.
