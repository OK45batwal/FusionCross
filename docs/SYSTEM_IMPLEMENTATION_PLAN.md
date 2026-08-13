# FusionCross — End-to-End System Implementation Plan

> System Goal: Transform FusionCross into an autonomous, commercial-grade macOS application runner competing directly with CodeWeavers CrossOver Mac on Apple Silicon (M1–M4+).

---

## 🏛 System Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         FusionCross macOS System                            │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────┐               ┌───────────────┐               ┌───────────────┐
│ System Layer  │               │ Runtime Layer │               │ UI/UX Layer   │
├───────────────┤               ├───────────────┤               ├───────────────┤
│ macOS .app    │               │ Wine-GE / CX  │               │ React + Vite  │
│ Finder / Dock │               │ D3DMetal 2.0  │               │ Dark & Light  │
│ APFS Clones   │               │ DXVK / Vulkan │               │ Command ⌘ K   │
│ GameController│               │ Recipe Engine │               │ Auto-Fix UI   │
└───────────────┘               └───────────────┘               └───────────────┘
```

---

## 📅 4-Phase System Build Plan

### Phase 1: Core Runtime Execution & Environmental Plumbing
- **Wine Binary & Environment Launcher (`src-tauri/src/wine/prefix.rs`)**:
  - Dynamically builds execution sub-processes with `WINEPREFIX`, `WINEDLLOVERRIDES`, `DYLD_FALLBACK_LIBRARY_PATH`, and `VK_ICD_FILENAMES`.
  - Configures Wine64 64-bit thunking for Apple Silicon Rosetta 2 execution.
- **Prefix Initialization (`wineboot`)**:
  - Automatically initializes clean Wine prefixes with `wineboot -u` without populating unneeded registry noise.

### Phase 2: D3DMetal 2.0 & DXVK Metal Translation Pipeline
- **Apple GPTK 2 Integration**:
  - Exposes `D3DMetal` for Direct3D 11/12 to Apple Metal translation.
  - Adds toggleable `MetalFX Spatial` & `Temporal` upscaling to double rendering frame rates in 4K games on Apple Silicon.
- **DXVK Vulkan Pipeline**:
  - Configures `DXVK 2.3` with MoltenVK for Direct3D 9/10/11 title compatibility.
  - Pre-compiles shader caches to eliminate first-render micro-stuttering.

### Phase 3: Winetricks Recipe Engine & APFS Instant Prefix Cloning
- **Automated `.fusionrecipe` Solver (`src-tauri/src/installer.rs`)**:
  - Automatically fetches and installs required dependencies (`vcrun2015-2022`, `dotnet48`, `corefonts`, `d3dcompiler_47`) for identified PE executables.
- **APFS Copy-on-Write Prefix Cloning (`src-tauri/src/wine/prefix.rs`)**:
  - Utilizes macOS `clonefile()` syscalls to create instant 0-second, 0-byte prefix duplicates for safe testing and backup.

### Phase 4: Native macOS Finder Integration & Self-Healing Diagnostics
- **Native `.app` Bundle Generator (`src-tauri/src/exporter.rs`)**:
  - Exports Windows apps as standard macOS `.app` bundles in `~/Applications/FusionCross/` complete with `Info.plist` and Retina icon resources.
  - Enables launching Windows applications directly from Finder, Spotlight (`⌘ Space`), or Dock.
- **Autonomous Health Diagnostics (`src-tauri/src/diagnostics.rs`)**:
  - Real-time `WINEDEBUG` log parser that identifies missing DLLs or graphics faults and offers 1-click self-healing repair actions.

---

## 🧪 System Verification Plan

1. **Backend Unit Tests**: Run `cargo test` in `src-tauri` (ensuring 26/26 tests pass).
2. **Frontend Type Checks**: Run `npm run check` (ensuring 0 TypeScript errors).
3. **Production Build**: Run `npm run build` (ensuring Vite bundle compiles cleanly).
4. **App Bundle Verification**: Export an application to `~/Applications/FusionCross/` and verify launch via macOS Spotlight.
