# FusionCross

Run Windows applications on macOS — through isolated Wine bottles.

A free, open Windows compatibility platform for Apple Silicon Macs, built with **Tauri 2 + React + TypeScript + Rust**, and Wine underneath.

> **Status:** Foundation layer — secure core, versioned state, structured errors, runtime engine abstraction, and a three-pane shell. Apps, bottles, and the installer flow land next.

## Getting started

```bash
npm install
npm run tauri dev        # desktop app with live reload
```

Requirements: macOS 12+, [Homebrew](https://brew.sh), Wine:

```bash
brew install --cask --no-quarantine wine-stable
```

## Development

```bash
npm run dev                # UI only (Vite)
npm run build              # typecheck + production frontend build
npm run tauri build        # release .app/.dmg
npm run lint               # ESLint
npm run check              # TypeScript typecheck
cargo test --manifest-path src-tauri/Cargo.toml   # Rust backend tests
```

CI (`.github/workflows/ci.yml`) runs rustfmt, clippy, Rust tests, ESLint, typecheck, frontend build, and a Tauri debug build on every push.

## Architecture

```
src/                 React frontend (services, components, pages)
src-tauri/src/       Rust backend
├── core/            errors (structured), ids, versioned state + migrations
├── wine/            RuntimeEngine trait + Wine probe (PRD §32)
├── manager.rs       process-wide state holder (backend is source of truth)
└── commands.rs      domain IPC commands (get_state, get_system_info, probe_runtime)
```

### Structured errors

Backend errors never cross IPC as bare strings — always `{ code, message, action }` (PRD §51), so the UI can offer a concrete fix:

```json
{ "code": "RUNTIME_NOT_FOUND", "message": "A compatible runtime is missing.", "action": "INSTALL_RUNTIME" }
```

### Versioned state

`state.json` carries `schema_version`; every future change appends a migration step (PRD §52). Unknown/future schemas are rejected; corrupt files degrade to defaults rather than crashing.

## Product direction

FusionCross 2.0 is defined in the [PRD](docs/PRD.md): smart installer, automatic compatibility, runtime manager, diagnostics + auto-fix, snapshots, and a compatibility database website. Built layer by layer, each one verified and committed.

## Roadmap

- [x] Foundation: errors, versioned state, engine trait, shell
- [ ] Bottle templates + creation
- [ ] Application library + library grid
- [ ] Smart installer (analyze → recommend → install → detect)
- [ ] Diagnostics + auto-fix
- [ ] Runtime manager (download, verify SHA-256, extract)
- [ ] Snapshots, advanced config, command palette
- [ ] Website: download, docs, compatibility database