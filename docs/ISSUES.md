# FusionCross backlog

Tracked follow-ups from the codebase review (May 2026).

## P0 — Core product honesty

- [x] Wire `run_app` to real Wine via shared `spawn_wine_process`
- [x] Use `sysinfo` for CPU/RAM/disk metrics (GPU/FPS remain 0 until real hooks exist)
- [x] Persist `verbose_logs` / `sandbox_enabled` via `get_settings` / `update_settings`
- [x] Stop killing all system Wine processes on app stop
- [ ] Convert Windows `C:\...` exe paths to Wine-friendly paths before spawn
- [ ] Call `wineboot -u` when initializing prefixes (not only mkdir + stub files)

## P1 — Real installs & downloads

- [ ] Connect Download Center to `download_wine_engine` with real release URLs
- [ ] Replace simulated `trigger_runtime_download` with HTTP + extract pipeline
- [ ] Run real `winetricks` in `install_dependencies` (stream stdout to UI)
- [ ] Deploy real DXVK PE binaries in `install_dxvk` (not text stubs)
- [ ] Catalog recipe installs: download/run actual installers per recipe

## P2 — Architecture & hardening

- [ ] Split `src-tauri/src/main.rs` into modules (`state`, `sandbox`, `wine`, `download`, `security`)
- [x] Validate tar archive members on extract (zip-slip / tar-slip)
- [x] Escape AppleScript picker prompt strings
- [ ] Unify branding (`fusionwine` repo vs `fusioncross` package)
- [ ] Add root `README.md` (dev setup, `npm run tauri dev`, Wine prerequisites)
- [ ] Persist onboarding completion flag
- [ ] Remove or gate demo seed apps/bottles behind a demo mode flag

## P3 — UX & polish

- [ ] Wire Settings “Default Bottle Engine” / HUD dropdowns to backend env defaults
- [ ] Per-process FPS/GPU via DXVK HUD or Metal counters when a game is running
- [ ] Frontend tests for store + critical flows
- [ ] CI: `cargo test`, `npm run build`, `cargo clippy`
