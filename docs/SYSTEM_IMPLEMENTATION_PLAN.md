# FusionCross Implementation Plan: CrossOver Compatibility Architecture

Based on deep technical research into CrossOver, Wine, GPTK, MSync, and D3DMetal, this plan details the changes required to elevate FusionCross from a basic Wine runner to a high-compatibility Windows gaming platform on macOS.

---

## Architecture Gap Analysis

| CrossOver Capability | Current FusionCross | Target State in FusionCross |
|:---------------------|:--------------------|:----------------------------|
| **MSync Fast Synchronization** | Not implemented | Native Mach semaphore sync toggle (`WINEMSYNC=1`, `WINE_MSYNC=1`) in Bottle state & launcher |
| **Graphics Translation Selection** | Simple string field | D3DMetal (GPTK), DXVK (Vulkan), DXMT (Metal), WineD3D with proper DLL overrides and shader cache awareness |
| **Performance HUD** | None | Toggleable Metal HUD (`MTL_HUD_ENABLED=1`) + DXVK HUD (`DXVK_HUD=fps,frametimes,gpu`) |
| **Wineserver Lifecycle & Kill** | App process kill only | Bottle-level `wineserver -k` kill switch and reset capability |
| **Wine Built-in Tools** | None | One-click launch of `winecfg`, `regedit`, `cmd`, `taskmgr`, `control` inside any bottle |
| **Dependency / Winetricks Engine** | Static template list only | Interactive verb installer (`vcrun2022`, `d3dcompiler_47`, `dotnet48`, etc.) per bottle |
| **Rosetta 2 & Metal Diagnostics** | Generic prefix checks | Rosetta 2 verification, Apple Silicon GPU feature checks, MSync availability |
| **Gaming Compatibility Profiles** | 5 productivity apps | Comprehensive database of AAA & popular games (Elden Ring, Cyberpunk 2077, Baldur's Gate 3, GTA V, etc.) |

---

## Step-by-Step Implementation Steps

### Step 1: Core State Schema Migration (v2 → v3)
- File: `src-tauri/src/core/state.rs`
- Add fields to `Bottle`:
  - `msync_enabled: bool` (default: true for gaming/dxvk, false for legacy)
  - `performance_hud: bool` (default: false)
  - `retina_mode: bool` (default: false)
- Increment `CURRENT_SCHEMA_VERSION = 3`
- Add forward migration from schema 2 to 3 with sensible defaults
- Update unit tests in `state.rs`

### Step 2: Templates & Defaults Update
- File: `src-tauri/src/core/templates.rs`
- Update `TemplateConfig` and `bottle_template()` to configure `msync_enabled`, `performance_hud`, and `retina_mode`.
- Ensure Gaming and DXVK-Optimized presets default to `msync_enabled: true` and appropriate DLL overrides.

### Step 3: Wine Process & Environment Launcher Enhancement
- File: `src-tauri/src/process/mod.rs` & `src-tauri/src/wine/prefix.rs`
- Implement wineserver control: `kill_wineserver(prefix: &Path)` via `wineserver -k`.
- Implement launching Wine built-in tools (`winecfg`, `regedit`, `cmd`, `taskmgr`, `control`).
- Enhance environment injection in `ProcessManager::spawn`:
  - If `msync_enabled`: inject `WINEMSYNC=1`, `WINE_MSYNC=1`, `WINEESYNC=0`.
  - If `performance_hud`: inject `DXVK_HUD=fps,frametimes,gputemp,memory,version` and `MTL_HUD_ENABLED=1`.
  - If `retina_mode`: inject `WINE_DPI=192` or display scaling flags.
  - Apply graphics backend-specific DLL overrides (`d3dmetal` vs `dxvk` vs `dxmt`).

### Step 4: Bottle Commands Expansion
- File: `src-tauri/src/commands.rs`
- Update `update_bottle` to accept `msync_enabled`, `performance_hud`, `retina_mode`.
- Add new Tauri IPC commands:
  - `kill_bottle_processes(bottle_id: String)`
  - `launch_wine_tool(bottle_id: String, tool: String)`
  - `install_bottle_verb(bottle_id: String, verb: String)`
- Update `apply_fix` in diagnostics to handle new fixes (Rosetta install, MSync enabling).

### Step 5: Advanced Diagnostics & Health Checks
- File: `src-tauri/src/diagnostics.rs`
- Add checks:
  - `rosetta`: Checks if Rosetta 2 translation runtime is installed on Apple Silicon.
  - `msync`: Checks if the bottle runtime supports MSync synchronization.
  - `graphics_backend`: Validates selected graphics backend against system capabilities.
- Provide actionable fixes (e.g. `softwareupdate --install-rosetta`, enable MSync).

### Step 6: Expand Gaming Compatibility Database
- File: `src-tauri/src/compatibility.rs`
- Add profiles for top games:
  - *Cyberpunk 2077* (D3DMetal, MSync, vcrun2022, d3dcompiler_47)
  - *Elden Ring* (D3DMetal, MSync, vcrun2022)
  - *Baldur's Gate 3* (D3DMetal / DXVK, MSync, vcrun2019)
  - *Grand Theft Auto V* (DXVK, MSync, vcrun2019, d3dcompiler_47)
  - *The Witcher 3: Wild Hunt* (D3DMetal / DXVK, MSync)
  - *Skyrim Special Edition* (DXVK, MSync, xna40/directx)
  - *Diablo IV* (D3DMetal, MSync, vcrun2022)
  - *Hades / Hades II* (DXVK / Metal, MSync)
  - Anti-cheat warning tags for multiplayer games.

### Step 7: Frontend Services & Type Definitions
- File: `src/services/tauri.ts`
- Update `Bottle` interface with `msync_enabled`, `performance_hud`, `retina_mode`.
- Add new invoke functions: `killBottleProcesses`, `launchWineTool`, `installBottleVerb`.

### Step 8: Frontend UI (BottlesView & DiagnosticsView)
- File: `src/views/BottlesView.tsx`
  - Add "Gaming & Performance" section with MSync toggle, Performance HUD toggle, and Retina toggle.
  - Add "Wine Configuration Tools" toolbar (`Winecfg`, `Regedit`, `CMD`, `Task Manager`).
  - Add "Installed Dependencies & Winetricks" quick installer.
  - Add "Force Stop All (Wineserver Kill)" emergency button.
- File: `src/views/DiagnosticsView.tsx`
  - Surface Rosetta 2 and MSync status badges and fix triggers.

### Step 9: Verification & Testing
- Run `cargo test` in `src-tauri` to verify schema migrations and new command logic.
- Run `npm run check` and `npm run build` to verify frontend TypeScript and asset compilation.
- Smoke test bottle creation and settings persistence.
