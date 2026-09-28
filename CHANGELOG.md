# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-09-28

### Added
- **50+ Game Compatibility Catalog & 1-Click Recipes**: Comprehensive directory of top Windows games (Cyberpunk 2077, Elden Ring, Hades II, Baldur's Gate 3, GTA V, Persona 3 Reload, Final Fantasy VII Remake, etc.) with pre-configured graphics backends, runtime recommendations, and 1-click installer automation.
- **CrossOver-Inspired Launchpad UI**: Redesigned bottle workspace and applications shelf into a clean macOS Launchpad-style icon grid with 64×64 squircle app icons, running status pulses, hover quick-launch overlay, and contextual menus.
- **Shelf Management (`unregister_application`)**: 1-click "Remove from Shelf" action allowing users to clean up any unwanted executable or uninstaller from their library.
- **Whisky-Wine Engine & Apple GPTK Integration**: Seamless integration with Whisky-Wine runtimes and Apple Game Porting Toolkit (D3DMetal) for high frame rates and DirectX 11/12 support on Apple Silicon.
- **Automated Anti-Clutter Scanner**: Strict executable filtering excluding setup helpers, crash reporters, redistributables, and temp directory binaries.
- **Automatic State Pruning**: On startup, FusionCross automatically purges legacy helper/uninstaller executables from existing databases.
- **macOS Native App Bundle Export**: 1-click export of installed Windows applications into standalone `.app` bundles in `~/Applications/FusionCross/` launchable via Spotlight and Dock.

### Changed
- Refactored center canvas to prioritize clean Launchpad icons over dense rectangular cards.
- Optimized MSync Mach semaphore flags (`WINEESYNC=1`, `WINEFSYNC=1`) for improved frame-time pacing.
- Upgraded diagnostic system to cover 11 automated health checks with single-click remediation.

### Fixed
- Fixed issue where Windows installers placed into `drive_c/installers/` or `/temp/` were mistakenly indexed as installed applications.
- Fixed symlink traversal risks preventing prefix escapes into the host root filesystem.
- Fixed base64 icon data extraction padding for Windows PE executables.

---

## [1.1.0] - 2026-08-15

### Added
- Multi-bottle isolation with preset templates (Gaming, Office, Adobe, Development).
- Bottle snapshot and restoration system.
- Direct C: Drive opening in macOS Finder.
- Command Palette (`⌘K`) for fast keyboard-driven navigation.

### Changed
- Migrated state persistence to schema version 2 with automated backward-compatible migrations.

---

## [1.0.0] - 2026-06-01

### Added
- Initial release of FusionCross.
- Tauri 2 + Rust + React architecture.
- Basic Wine prefix management and executable launcher.
