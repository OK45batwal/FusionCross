# FusionCross — Comprehensive Quality Assurance & Test Plan

**Document Version:** 2.0.0  
**Target Platform:** macOS 13+ (Ventura, Sonoma, Sequoia) on Apple Silicon (M1/M2/M3/M4) & Intel (x86_64)  
**Core Technologies:** Tauri 2, Rust 1.80+, React 19, TypeScript, Wine / CrossOver Engine, Game Porting Toolkit (D3DMetal), DXVK, DXMT, MSync  

---

## 1. Executive Summary & Test Strategy

FusionCross enables seamless execution of Windows games and productivity applications on macOS without virtual machines or cloud emulation. Because the software interacts directly with low-level macOS subsystems (Mach kernel semaphores, Rosetta 2 ahead-of-time translation, Metal 3 shading engines, and Wine PE/Mach-O loaders), comprehensive testing across multiple abstraction layers is paramount.

This document defines the complete verification methodology for FusionCross:
1. **Automated Unit Testing:** Strict type, state migration, security boundary, and PE parser tests.
2. **Integration & IPC Verification:** Tauri command invocations, schema validation, and lifecycle supervision.
3. **Graphics & Synchronization Subsystems:** D3DMetal, DXVK/MoltenVK, DXMT, WineD3D, and MSync (Mach semaphores).
4. **Bottle & Dependency Management:** Isolated prefix generation, Winetricks verbs, and snapshot backup/rollback.
5. **Real-World Game & Application Verification:** Categorized test suites for DirectX 9, 11, 12, 32/64-bit, and anti-cheat handling.
6. **Fault Injection & Edge Cases:** Prefix corruption recovery, disk pressure, zombie process sweeps, and Rosetta 2 failure states.
7. **CI/CD Pipeline & Release Sign-Off Matrix:** Deterministic pre-flight checks before packaging into signed DMG bundles.

---

## 2. Test Architecture & Frameworks

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Level 6: End-to-End System                     │
│               Real Game Smoke Tests & User Workflows                   │
├────────────────────────────────────────────────────────────────────────┤
│                     Level 5: Frontend UI Reactivity                    │
│             React 19 + TypeScript + Vite + ESLint + Themes             │
├────────────────────────────────────────────────────────────────────────┤
│                   Level 4: Runtime & Wine Subsystems                   │
│        D3DMetal, DXVK, MSync, Winetricks Verbs, Wineserver Lifecycle   │
├────────────────────────────────────────────────────────────────────────┤
│                   Level 3: Tauri IPC & Manager State                   │
│               Tauri 2 Invoke Handlers + AppState V3 Redux              │
├────────────────────────────────────────────────────────────────────────┤
│                 Level 2: Unit Testing (Rust & TypeScript)              │
│       State Migrations, PE Analysis, Path Traversal, Zip Slip Defense  │
├────────────────────────────────────────────────────────────────────────┤
│                    Level 1: Static Analysis & Types                    │
│          `cargo check`, `cargo clippy`, `tsc --noEmit`, `eslint .`     │
└────────────────────────────────────────────────────────────────────────┘
```

| Layer | Harness / Tool | Execution Target | Criteria for Pass |
|---|---|---|---|
| **Static & Types** | `tsc --noEmit`, `eslint .`, `cargo clippy -D warnings` | Entire workspace | Zero errors, zero warnings |
| **Rust Unit Tests** | `cargo test --manifest-path src-tauri/Cargo.toml` | `src-tauri/` | 100% test pass rate |
| **State Migrations** | `src-tauri/src/core/state.rs` test harness | v1 → v2 → v3 JSON schemas | Lossless data migration |
| **Sandbox & Security** | `core::paths`, `security::archives` unit tests | Boundary enforcement | Reject all relative traversal & zip slips |
| **Frontend Bundle** | `npm run build` (Vite 7) | Production distribution | Clean bundle output without chunks missing |
| **Process Control** | `wineserver -k`, `pgrep -f`, `launch_application` | macOS Darwin kernel | Clean shutdown; zero orphaned processes |

---

## 3. Unit Test Specifications

### 3.1 State Persistence & Schema Migrations (`src-tauri/src/core/state.rs`)
* **Test Objective:** Guarantee backward compatibility and non-destructive schema evolution as new Wine features are added.
* **Test Cases:**
  - `empty_json_migrates_to_current`: Empty or missing `state.json` boots into schema v3 with initial default bottle templates.
  - `v1_json_migrates_additive_fields`: Schema v1 state gracefully injects missing v2 and v3 fields (`msync_enabled = true`, `performance_hud = false`, `retina_mode = false`, `wine_tool = None`).
  - `v2_json_migrates_to_v3`: Schema v2 bottles upgrade into v3 with gaming flags preserved.
  - `future_schema_is_rejected`: Schema version `999` is rejected with `SCHEMA_VERSION_TOO_NEW` without truncating the user's data.
  - `current_schema_roundtrips`: Serializing and deserializing current state produces an exact bitwise match.

### 3.2 Path Traversal & Security Boundary Testing (`src-tauri/src/core/paths.rs`)
* **Test Objective:** Enforce sandbox containment and prevent arbitrary file execution outside designated directories.
* **Test Cases:**
  - `is_inside_respects_boundaries`: Absolute paths under `~/Library/Application Support/FusionCross` return `true`.
  - `rejects_escapes_and_relative_lookalikes`: `../../../../etc/passwd`, `/System/Library/`, and symlink escapes return `false` and trigger `ACCESS_DENIED`.
  - `safe_child_path`: Joining paths normalizes all components and validates within the canonical root.

### 3.3 PE Header Analysis & Architecture Detection (`src-tauri/src/installer.rs`)
* **Test Objective:** Accurately inspect Windows executables and `.msi` installers to route to proper bottle architectures.
* **Test Cases:**
  - `detects_x64_executable`: 64-bit PE binaries (Machine `0x8664`) identify as `Architecture::X64`.
  - `detects_x86_and_arm`: 32-bit PE binaries (`0x014c`) identify as `Architecture::X86`; ARM64 binaries (`0xaa64`) identify as `Architecture::Arm64`.
  - `rejects_non_windows_files`: Mach-O binaries, ELF binaries, and non-PE files return `INVALID_BINARY` before launching Wine.

### 3.4 Runtime Version Parsing & Engine Discovery (`src-tauri/src/wine/engine.rs`)
* **Test Objective:** Parse arbitrary Wine engine strings from `wine --version`.
* **Test Cases:**
  - `parses_wine_versions`: Correctly parses `wine-9.0`, `wine-8.0-rc1`, `crossover-24.0.0`, and `wine-ge-custom-8-26`.
  - Engine detection recognizes presence of `wineserver`, `wine64`, and auxiliary libraries.

---

## 4. Subsystem Integration & Verification

### 4.1 Graphics Translation Backends
FusionCross supports four discrete graphics translation layers. Each backend must be validated against its driver requirements and environment variables:

| Graphics Backend | Key Environment Variables | Target APIs | Validation Verification |
|---|---|---|---|
| **D3DMetal** | `WINED3DMETAL=1`, `MTL_HUD_ENABLED=1` | DirectX 11, DirectX 12 | Apple Metal 3 pipeline active; Metal HUD visible top-right |
| **DXVK** | `DXVK_HUD=fps,frametimes,gpubound`, `WINEDLLOVERRIDES=dxgi,d3d11,d3d10core=n` | DirectX 9, 10, 11 via MoltenVK | Vulkan ICD loads `libMoltenVK.dylib`; FPS counter renders |
| **DXMT** | `WINEDLLOVERRIDES=d3d11=n` | DirectX 11 via direct Metal | Direct Metal shader translation |
| **WineD3D** | `LIBGL_ALWAYS_SOFTWARE=0` | DirectX 1-9 legacy, OpenGL | OpenGL 4.1 Core Context fallback active |

#### Verification Steps:
1. Create a clean bottle configured with `GraphicsBackend::D3DMetal`.
2. Launch a 3D rendering test (`dxdiag` or `FurMark.exe`).
3. Verify via `ps eww <PID>` that `WINED3DMETAL=1` is injected.
4. Toggle `performance_hud = true` and ensure Metal HUD appears in the render viewport.
5. Repeat for `GraphicsBackend::Dxvk` and verify `DXVK_HUD` presence.

---

### 4.2 MSync Synchronization Verification
* **Background:** Standard Wine `esync` relies on Linux `eventfd`, which does not exist in Darwin. macOS fallback relies on wineserver pipe IPC, causing high context-switching latency. FusionCross enables `WINEMSYNC=1`, utilizing Mach semaphores.
* **Test Steps:**
  1. Boot a gaming bottle with `msync_enabled = true`.
  2. Inspect process environment: `ps eww <PID> | grep WINEMSYNC`.
  3. Verify system log via `log stream --predicate 'process CONTAINS "wine"'`: ensure Mach semaphore allocations succeed without fallback warnings.
  4. Perform load test under multi-threaded rendering (e.g., Unreal Engine / Unity titles): verify 0 deadlock conditions or Mach semaphore pool exhaustion.

---

### 4.3 Wineserver Lifecycle & Orphan Process Control (`src-tauri/src/wine/prefix.rs`)
* **Test Objective:** Prevent ghost background wineserver processes from retaining file locks or burning CPU cycles when an application terminates.
* **Test Scenarios:**
  - **Graceful Termination:**
    1. Launch application `app_test_01`.
    2. Invoke `stop_application("app_test_01")`.
    3. Verify SIGTERM is sent, process unregisters from `RunningInfo`, and wineserver exits gracefully.
  - **Hard Kill / Force Stop:**
    1. Launch an application.
    2. Invoke `kill_bottle_processes("bottle_id")`.
    3. Verify `wineserver -k` executes, killing all wineserver and child PE processes within 500ms.
    4. Assert `pgrep -f "wineserver.*bottle_id"` returns exit code `1`.

---

### 4.4 Winetricks Verb & Wine Config Automation
* **Test Objective:** Install essential Windows redistributables without manual command-line intervention.
* **Verbs in Scope:**
  - `vcrun2015-2022` (Visual C++ 2015–2022 Redistributable x86/x64).
  - `dotnet48` (Microsoft .NET Framework 4.8).
  - `d3dcompiler_47` (Direct3D HLSL Compiler DLL).
  - `corefonts` (Standard Windows TrueType Fonts).
  - `directx9` (Legacy DirectX End-User Runtimes).
* **Wine Tools Verification:**
  - Verify `launch_wine_tool(bottle_id, "winecfg")` opens the Wine Configuration window.
  - Verify `launch_wine_tool(bottle_id, "regedit")` opens the Registry Editor.
  - Verify `launch_wine_tool(bottle_id, "taskmgr")` opens the Wine Task Manager.
  - Verify `launch_wine_tool(bottle_id, "cmd")` launches the Command Prompt.

---

### 4.5 Snapshot Backup & Restore (`src-tauri/src/snapshots.rs`)
* **Test Objective:** Safeguard user prefixes before applying patches or installing major software.
* **Test Procedure:**
  1. Initialize bottle `Test_Snapshot_Bottle`.
  2. Create a marker file `drive_c/marker_v1.txt`.
  3. Invoke `create_snapshot(bottle_id, "Pre-Patch Backup")`.
  4. Verify `.tar.gz` archive is created with valid checksum.
  5. Delete `marker_v1.txt` and create `drive_c/marker_v2.txt`.
  6. Invoke `restore_snapshot(snapshot_id)`.
  7. Verify `marker_v1.txt` is restored and `marker_v2.txt` is absent.

---

## 5. Frontend & UI Verification

### 5.1 Native Desktop Application Feel
- **Navigation & Routing:** Ensure all 8 native views switch instantly without layout shifts or memory leaks:
  - `home`: Recent games, active bottles, system info pill, quick actions.
  - `applications`: Grid & list view of Windows apps, search bar, favorite filters, launch/stop actions.
  - `installer`: 4-step wizard (Select File → Analyze Binary → Configure Bottle → Install & Launch).
  - `bottles`: Bottle cards with D3DMetal, MSync, Retina, and HUD toggles; Wine tools menu; Winetricks dialog; wineserver kill button.
  - `runtimes`: Engine probes, active version detection, import archive drawer.
  - `compatibility`: Filterable database by tier (Platinum, Gold, Silver, Bronze, Untested, Borked).
  - `diagnostics`: System readiness audit (Rosetta 2, Wine, MSync, Metal), with auto-fix trigger buttons.
  - `settings`: Config directory paths, default graphics engine, telemetry toggle, safe mode.
- **Global Shortcut:** Pressing `⌘K` from any screen summons the floating Command Palette with immediate keyboard focus.
- **Theming:** Dark and Light mode toggle seamlessly; palette values persist across app reboots via `localStorage`.

---

## 6. Real-World Game Compatibility Matrix

| Game Title | API / Arch | Expected Engine | Target Settings | Expected Result | Pass Criteria |
|---|---|---|---|---|---|
| **Cyberpunk 2077** | DX12 / 64-bit | D3DMetal (GPTK) | `msync: true`, `hud: true` | Platinum | Runs > 45 FPS on M1 Max / M2 Pro; Audio & shaders sync |
| **Elden Ring** | DX12 / 64-bit | D3DMetal (GPTK) | `msync: true`, EAC disabled | Gold | Bootable into open world; 60 FPS lock |
| **Baldur's Gate 3** | DX11/Vulkan / 64-bit | DXVK or D3DMetal | `msync: true` | Platinum | Fluid gameplay, save game persistence |
| **The Witcher 3: Wild Hunt** | DX11/DX12 / 64-bit | D3DMetal / DXVK | `msync: true` | Platinum | No texture corruption, hair physics stable |
| **Grand Theft Auto V** | DX11 / 64-bit | DXVK | `msync: true`, `vcrun2022` | Platinum | Stable 60 FPS, controller input supported |
| **Skyrim Special Edition** | DX11 / 64-bit | DXVK | `msync: true`, `x360ce` | Platinum | Mods & audio work without crackling |
| **Hades** | D3D11 / 64-bit | DXVK / WineD3D | Default | Platinum | Flawless 120Hz rendering |
| **Valorant / Fortnite** | Kernel Anti-Cheat | Any | Any | **Blocked** | Application blocked with clear notification (Vanguard / EAC kernel driver unsupported) |

---

## 7. Fault Injection & Edge Case Testing

| Failure Mode | Injected Condition | Expected Behavior |
|---|---|---|
| **Missing Rosetta 2** | Machine is Apple Silicon, `/Library/Apple/usr/share/rosetta/rosetta` absent | Diagnostics flags `ROSETTA_MISSING` and offers 1-click `softwareupdate --install-rosetta` fix. |
| **Corrupted `state.json`** | File overwritten with truncated or malformed JSON | `Manager` recovers by logging warning, creating backup `state.json.bak`, and initializing defaults without crashing. |
| **Disk Space Exhaustion** | Storage capacity < 1 GB during bottle creation | Prefix creation halts, returning `INSUFFICIENT_STORAGE` with required disk space guidance. |
| **Permission Denied** | Target bottle directory read-only | UI surfaces structured error `{ code: "PERMISSION_DENIED", action: "CHECK_PERMISSIONS" }`. |
| **Orphaned Wine Process** | Process killed via Activity Monitor while Wine running | `list_running` accurately drops dead PID upon next polling tick; no UI lockup. |

---

## 8. Continuous Integration & Release Sign-Off Checklist

Before any tagged release or production DMG distribution, QA must verify:

- [ ] **Typecheck:** `npm run check` passes with 0 TypeScript diagnostics.
- [ ] **Linter:** `npm run lint` passes without warnings.
- [ ] **Frontend Build:** `npm run build` completes cleanly.
- [ ] **Rust Formatting:** `cargo fmt --check` succeeds.
- [ ] **Rust Clippy:** `cargo clippy --all-targets -- -D warnings` completes with 0 warnings.
- [ ] **Automated Unit Tests:** `cargo test` passes all 27 unit tests.
- [ ] **Binary Analysis Verification:** Tested with 32-bit and 64-bit PE executables.
- [ ] **Diagnostics Auto-Fix:** Tested repair workflows for Rosetta 2 and prefix permissions.
- [ ] **Package Verification:** `npm run tauri build` generates valid `FusionCross.app` and `.dmg`.
- [ ] **Code Signing & Notarization:** Verify Gatekeeper accepts bundle (`spctl -a -vvv -t install /path/to/FusionCross.app`).
