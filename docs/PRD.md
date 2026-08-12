# FusionCross — Product Requirements Document

> Version 1 · macOS · Apple Silicon (M1–M4+) · Free / Open Source · Tauri 2 + React + TypeScript + Rust · Wine
> Slogan: **FusionCross — Windows Apps. The Mac Way.**

## 1. Vision & promise

The core philosophy: **users should not need to understand Wine to use FusionCross.**

FusionCross automatically handles runtime selection, environment creation, bottle configuration,
graphics backends, dependencies, DLL config, environment variables, app detection, executable
discovery, icons, compatibility config, diagnostics and troubleshooting. The user only
**installs, configures, launches, fixes, manages.**

The promise is *maximum practical compatibility*, never guaranteed universal compatibility
(anti-cheat, kernel drivers, DRM and deep kernel integration may be unsupported — FusionCross
says so clearly).

## 2. Ecosystem

Two products sharing metadata:

```
FusionCross
├── Desktop App  — runtimes, bottles, applications, diagnostics, runtime manager
└── Website      — download, documentation, compatibility DB, recipes, releases, community
```

## 3. Users

| User | Needs | Requirement |
|------|-------|-------------|
| Normal macOS user | Windows utilities, Office, legacy tools | extremely simple, no Wine knowledge |
| Gamer | games, Steam, launchers, controller support | FPS, graphics backend, performance |
| Developer | SDK tools, testing, custom runtimes | advanced controls |
| Power user | DLL overrides, registry, env vars, custom args, debug logs | full control, hidden from beginners |

## 4. Desktop app — main modules (PRD §6)

`Home · Applications · Bottles · Install Application · Runtime Manager · Compatibility · Diagnostics · Settings`

Sidebar (PRD §19): HOME / LIBRARY (Applications, Favorites, Recent) / ENVIRONMENTS (Bottles, Runtimes) / TOOLS (Install App, Compatibility, Diagnostics) / Settings.

## 5. UX rules

- Home focuses on **actions**, not statistics — continue where you left off, quick launch.
- Application Library: grid + list, search, filters, sorting, favorites, categories, running states; card states normal/hover/running/installing/error/update/compat-warning.
- Installer: drag `.exe` / `.msi` or browse → analyze → compatibility → bottle → config → dependencies → install → detect → finish (PRD §25).
- Command palette `⌘ K` (launch, install, create bottle, runtime manager, diagnostics, settings, search).
- macOS menu bar tray: running apps, quick actions, show/settings/quit.
- Notifications: installation complete, launch failure with suggested fix.
- **Beginner Mode** default: Runtime/Graphics/Windows/Dependencies = Automatic; "Advanced" reveals technical controls. Every advanced setting has a *What does this do?* tooltip.
- Safe Mode: disables DXVK/D3DMetal/custom DLLs/registry/experimental, keeps debug logging.
- Every error answers: *what happened / why / what can I do* (PRD §78).

## 6. Compatibility engine (PRD §34–35)

Backend service taking `application, version, chip, macOS, runtime availability, graphics availability`
and returning `runtime, graphics, windows_version, dependencies, environment, dll_overrides,
registry, launch_arguments, compatibility_score, known_issues`. Profile shape:

```json
{ "application": "example", "version": "2026", "runtime": "wine-ge",
  "windows_version": "win10", "graphics": "d3dmetal",
  "dependencies": ["vcrun2022"], "environment": {}, "dll_overrides": [],
  "launch_arguments": [], "compatibility": 92 }
```

## 7. Runtime engines (PRD §32)

`RuntimeEngine` trait — name, version, validate, create_prefix, launch (PRD §32). Implementations:
Wine Stable, Wine Staging, Wine-GE, Proton-GE, Custom. Graphics manager: automatic by default,
then DXVK / D3DMetal / VKD3D / WineD3D.

## 8. Diagnostics & auto-fix (PRD §36–37)

On failure, `DiagnosticsEngine` runs environment checks → `DiagnosticResult` → `FixEngine` produces
`FixAction` (install dependency, switch graphics, reset DXVK, disable DLL override, restore
snapshot, change windows version, change runtime, repair bottle) → apply → verify → retry launch.

## 9. Bottles

Bottle architecture (PRD §29): id, name, type/template, prefix path, runtime, windows version,
graphics, env vars, DLL overrides, registry, applications, dependencies, snapshots, size, created,
last used. Templates: Gaming, Office, Adobe, Development, Legacy, Custom (§28). Snapshots
create/restore/delete/export (§41).

## 10. State & storage (PRD §52–53)

Versioned JSON with migrations (every schema change appends a step). Backend is source of truth;
frontend mirrors it. Eventually move to SQLite with tables for applications, bottles, runtimes,
compatibility_profiles, dependencies, sessions, snapshots, diagnostics, recipes, settings.

## 11. Security (PRD §54)

Path validation, sandbox validation, archive traversal protection, download URL validation,
runtime verification (SHA-256), command argument validation, IPC validation, file permission
checks, safe process execution, CSP. Never execute arbitrary user-controlled shell commands.

Runtime download pipeline: validate source → download → verify checksum → validate archive →
safe extraction → validate runtime → install → register (§55).

## 12. Data model surfaces (PRD §50–51)

Domain-oriented IPC: `get_applications, get_application, install_application, launch_application,
stop_application, get_bottles, create_bottle, clone_bottle, delete_bottle, repair_bottle,
get_runtimes, install_runtime, remove_runtime, analyze_installer, get_compatibility,
generate_recommendation, run_diagnostics, apply_fix, create_snapshot, restore_snapshot`.

Structured errors (`FusionError`) with codes:
`APPLICATION_NOT_FOUND, BOTTLE_NOT_FOUND, RUNTIME_NOT_FOUND, INVALID_EXECUTABLE,
DEPENDENCY_MISSING, GRAPHICS_INIT_FAILED, INSTALLATION_FAILED, LAUNCH_FAILED, PERMISSION_DENIED,
INVALID_PATH, ARCHIVE_VALIDATION_FAILED, RUNTIME_VERIFICATION_FAILED`.

## 13. Website (§7–17, §61–75)

Information architecture: Home, Download, Features, Compatibility, Apps, Recipes, Documentation
(Getting Started, Installing Apps, Bottles, Runtimes, Graphics, Troubleshooting, Advanced),
Releases, Community, GitHub, FAQ, About.

- Download with architecture detection, SHA-256, GitHub-release-backed metadata (§64–66 — never host mysterious unsigned binaries).
- Compatibility database: app, version, publisher, category, score, status, runtime, graphics, dependencies, known issues/fixes, tested macOS/chips, community reports; statuses Excellent/Good/Mostly Working/Limited/Broken/Unsupported/Untested.
- Recipes are configuration metadata, never copyrighted installers (§17).
- Tech: Next.js + TypeScript + Tailwind + shadcn/ui + MDX, PostgreSQL/Supabase backend, `GET /api/apps/:id`, `/api/releases/latest`, etc., admin panel for maintainers (§63).
- Open Source section with GitHub links (§72); community reports opt-in, privacy-first (§60, §74 — no telemetry by default).

Design system (§69): background `#080A0D`, surface `#101419`, elevated `#171C22`, border `#262D35`,
primary indigo/violet, success/warning/error green/amber/red; SF Pro + Inter.

## 14. Quality (PRD §79–80)

Unit tests: path validation, bottle/runtime management, compatibility engine, dependency engine,
graphics selection, state migrations, process manager. Integration: install → create → configure →
launch → stop → restart → persist → restore. Frontend tests for library, installer, bottles,
runtime manager, diagnostics, settings.

CI on every PR: TS, ESLint, Rust fmt, Rust Clippy, Cargo test, frontend test, build. Release:
build → test → sign → notarize → DMG → checksum → GitHub Release → website update.

## 15. Versioning & roadmap (§81–85)

SemVer. **2.0 MVP** (first): new UI, application library, smart installer, bottle templates,
runtime manager, compatibility engine, graphics auto-selection, dependency manager, diagnostics,
safe mode, app details, process manager, website, download page, documentation.

**2.1**: snapshots, portable bottles, launch profiles, compatibility DB, recipes, better EXE
analysis, community reports. **2.2**: hardware DB, automatic compatibility learning, advanced
troubleshooting, performance analytics, runtime update manager. **3.0**: cloud compatibility sync,
recipe marketplace, automated compatibility testing, plugin system, more engines, profiling,
cross-device config sharing.

## 16. Success metrics (§86) & definition of done (§87–88)

- High percentage of installers install successfully.
- A beginner can install + launch an app without manually configuring Wine.
- Known problems are auto-diagnosed and fixed where technically possible.
- Desktop done: install → detect app → evaluate compat → auto-configure bottle/runtime/graphics →
  dependencies → Launch → stop → multiple apps → diagnose failures → known fixes → backups → logs →
  advanced customization (§87).
- Website done: clear product explanation, working download, latest release, Apple Silicon
  requirements, install docs, compatibility DB, recipes, GitHub access, release notes, FAQ,
  privacy + security info (§88).

## 17. Core differentiator (§93)

Traditional wine frontends make the user understand Wine settings. FusionCross does the work:

```
User → "Install Photoshop" → FusionCross analyzes → recommends → configures → installs →
launches → monitors → and if there's a problem: diagnoses → fixes.
```

That feedback loop (install → launch → diagnose → fix) is the product innovation.