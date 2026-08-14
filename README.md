# FusionCross

**Run Windows applications on macOS — the Mac way.**

FusionCross is a free, open-source Windows compatibility layer for Apple Silicon Macs. It manages Wine runtimes, isolated bottle environments, Apple D3DMetal graphics acceleration, dependency resolution, and health diagnostics so you can run Windows software natively — no VirtualBox, no Parallels subscription, no Wine CLI wrangling.

Built with **Tauri 2 + React + TypeScript + Rust**, with Wine underneath.

## Features

- **One-click installer** — drop any `.exe` or `.msi`; FusionCross analyzes the binary header, picks the right Wine runtime (Stable / Wine-GE / Proton-GE), and resolves dependencies automatically.
- **Isolated bottle environments** — templates for Gaming, Office, Adobe, and Development keep apps sandboxed and clean.
- **D3DMetal & DXVK graphics** — Apple Game Porting Toolkit and DXVK Vulkan translation for high frame rates on M1–M4.
- **Runtime manager** — probe, import, and manage Wine engines with SHA-256 verification.
- **Compatibility database & recipes** — search tested applications and apply 1-click Crosstie-style setup recipes.
- **Health diagnostics & auto-fix** — run checks, read *what happened / why / what can I do*, and repair prefixes with one click.
- **Snapshots & restore** — roll back a bottle to any saved state.
- **Native `.app` export** — ship any installed Windows app as a Finder/Dock/Spotlight-launchable macOS app.
- **Command palette (⌘K)** — launch apps and navigate from anywhere.
- **Dark / Light themes** — persisted system-aware theming.

## Getting started

Requirements: **macOS 13+ on Apple Silicon**, [Homebrew](https://brew.sh).

```bash
# 1. Install Wine
brew install --cask --no-quarantine wine-stable

# 2. Install JS dependencies
npm install

# 3. Run the desktop app with live reload
npm run tauri dev
```

## Development

```bash
npm run dev          # UI only (Vite, http://localhost:1420)
npm run build        # typecheck + production frontend build
npm run lint         # ESLint
npm run check        # TypeScript typecheck
npm run tauri build  # release .app / .dmg
npm run website      # serve the standalone marketing site (website/)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust backend tests
```

The website lives in `website/` — a self-contained static site (served with `npm run website` or any static host) that doubles as the in-app download/catalog view.

CI (`.github/workflows/ci.yml`) runs rustfmt, clippy (`-D warnings`), Rust tests, ESLint, typecheck, a frontend build, and a debug Tauri build on every push.

## Architecture

```
src/                 React frontend (components, views, IPC service)
src-tauri/src/       Rust backend
├── commands.rs      domain IPC commands (single invocation surface)
├── manager.rs       process-wide state holder — backend is the source of truth
├── core/            structured errors, ids, versioned state + migrations
├── wine/            RuntimeEngine trait + Wine probe/prefix/scanner
├── process/         app launch & monitoring
├── runtime/         runtime engine abstraction
├── diagnostics.rs   health checks + auto-fix
├── exporter.rs      macOS .app bundle export
├── snapshots.rs     bottle snapshots
└── security/        archive extraction & verification
```

### Structured errors

Backend errors never cross IPC as bare strings — always `{ code, message, action }`, so the UI can offer a concrete fix:

```json
{ "code": "RUNTIME_NOT_FOUND", "message": "A compatible runtime is missing.", "action": "INSTALL_RUNTIME" }
```

### Versioned state

`state.json` carries `schema_version`; every future change appends a migration step. Unknown/future schemas are rejected; corrupt files degrade to defaults rather than crashing.

## Design system

A single token-driven design language is shared across the app and the marketing site:

- Dark-first, light-secondary theme switched via `data-theme` and persisted to `localStorage`.
- Graphite neutral ramp + a single indigo accent + mint/amber/red status colors.
- Defined once in `src/index.css` (Tailwind v4 `@theme`) and mirrored in `website/styles.css`.

## Documentation

- [Product requirements (PRD)](docs/PRD.md)
- [System implementation plan](docs/SYSTEM_IMPLEMENTATION_PLAN.md)
- [CrossOver parity roadmap](docs/CROSSOVER_PARITY_ROADMAP.md)

## License

MIT — free and open source, no subscriptions, no telemetry by default, no unsigned binaries.
