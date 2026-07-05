# FusionCross – Project Improvement Plan

## Current State

Tauri v2 desktop app managing Wine bottles on macOS with a React/TypeScript frontend. The app has good architecture separation but contains several mock/stub implementations, dead code paths, hardcoded paths, and monolithic components.

## Phases

### Phase 1: Fix Stub/Mock Implementations (DONE)
- [x] **1.1** Replace mock DXVK install (`commands.rs:915-921`) with real DXVK tarball download + extraction
- [x] **1.2** Replace fake runtime download progress (`downloads.rs:138-158`) with real download or remove the UI path
- [x] **1.3** Remove hardcoded `/Users/omkar/...` paths from frontend browser fallbacks

### Phase 2: Fix Dead Code & Logic Bugs (DONE)
- [x] **2.1** Fix `installRecipe` dead code path — make preset/catalog installs work or remove catalog install buttons
- [x] **2.2** Fix process lifecycle: clear `active_process_id` when Wine process exits naturally
- [x] **2.3** Fix fake PID display in PerformanceMonitor
- [x] **2.4** Replace `window.confirm` / `alert()` with custom modal components

### Phase 3: Improve Backend Robustness (DONE)
- [x] **3.1** Add depth limit (32) to `calculate_dir_size` recursion in `state.rs`
- [x] **3.2** Add `validate_command_text` for `installer_path` in `install_windows_software`
- [x] **3.3** Replace all 6 fire-and-forget `std::thread::spawn` with panic-catching `spawn_fallible` helper in `wine.rs`
- [x] **3.4** Add `$PATH` search via `which` fallback in `resolve_wine_binary` and `resolve_winetricks_binary`

### Phase 4: Refactor Frontend (DONE)
- [x] **4.1** Break up monolithic `store/index.tsx` (916→209 lines) into 4 domain hooks: `useBottles`, `useApps`, `useRuntimes`, `useRecipes`
- [x] **4.2** Extract shared `RunCommandModal` and `ConfirmModal` components; reduce BottleManager by ~180 lines, Library by ~160 lines
- [x] **4.3** Add `ErrorBoundary` class component wrapping main content; add `Notifications` toast system with auto-dismiss in `AppProvider`
- [x] **4.4** Add `loading` state to `AppProvider` with spinner shown during initial data fetch

### Phase 5: Polish & DX (DONE)
- [x] **5.1** Add ESLint + Prettier configuration
- [x] **5.2** Add comprehensive Rust tests for security/validation modules
- [x] **5.3** Verify `npm run build` and `cargo test` pass clean
- [x] **5.4** Final audit of remaining hardcoded strings and magic numbers

### Phase 6: UI/UX Redesign (DONE)
- [x] **6.1** Extract 40+ CSS custom properties into `:root` tokens; add `reduced-motion` queries; add `animate-scale-in`, `animate-fade-in-up`, `animate-slide-in-right` keyframes; `stagger-*` delay utilities
- [x] **6.2** Sidebar: collapsible (toggle button, smooth width transition, icon-only mode), macOS traffic light spacing, gradient icon branding, `aria-current` nav items, `aria-label` on toggle
- [x] **6.3** Dashboard: `MetricCard` component with stagger animations, quick-launch favorites grid, `EmptyState` for no history/bottles, `animate-fade-in-up` on cards
- [x] **6.4** `ModalShell` reusable component: configurable accent, Esc-to-close, header/content/footer slots, consistent backdrop and glass border
- [x] **6.5** PerformanceMonitor: removed `alert()` clipboard notification, moved to clipboard-only with no intrusive dialog
- [x] **6.6** `useKeyboard` hook with meta/ctrl modifiers; `Cmd+1-7` tab switching, `Cmd+K` → dashboard, `Escape` → close wizard
- [x] **6.7** Global keyboard shortcuts in `AppContent` via `useKeyboard`; `ModalShell` has built-in Esc handler
- [x] **6.8** Accessibility: `:focus-visible` in CSS, `aria-label` on sidebar nav buttons, `aria-current="page"` on active tab, `aria-hidden` on decorative icons, `role="navigation"` on nav
- [x] **6.9** `EmptyState` component with icon/title/description/action props; used in Dashboard for no-records states; replaced all `alert()` calls across Settings, Library, BottleManager with `notify()` system or console

### Phase 7: Download Website (DONE)
- [x] **7.1** Scaffold Node.js + Express project in `website/`; `package.json`, `server.js` with static serving, REST API endpoints, release notes route
- [x] **7.2** Hero: full-viewport gradient background, animated title with gradient text, badge, download CTA, macOS requirement note
- [x] **7.3** Features: 6-card grid (Bottle Manager, DXVK+MoltenVK, One-Click Install, Telemetry, Runtime Manager, Rosetta Ready) with hover elevation
- [x] **7.4** Download: ARM64 + x64 DMG cards with version/size metadata, SHA-256 checksum rows with selectable text
- [x] **7.5** Gallery: responsive placeholder grid with SVG icons; ready for real screenshots
- [x] **7.6** FAQ: JS-powered accordion with `aria-expanded`, smooth max-height animation, 6 questions
- [x] **7.7** Releases page (`/releases`) fetches `/api/releases` from `changelog.json` and renders version cards with bullet notes
- [x] **7.8** Dark theme: full design token system matching FusionCross desktop (graphite palette, neon accents, glass borders, monospace typography); responsive breakpoints; `prefers-reduced-motion` support
- [x] **7.9** Analytics: POST `/api/visit` increments JSON counter, GET `/api/visits` returns count, footer displays live visitor count with 30s polling

---

## Milestone 2 — Whisky-Inspired UI Redesign

Goal: Redesign FusionCross to match Whisky's clean macOS-native UI/UX and app experience.

### Phase 8: Simplify Navigation & Layout (DONE)
- [x] **8.1** Trim sidebar to: Bottles, Library, Settings (merge Telemetry into Settings, Downloads into Bottles)
- [x] **8.2** Replace table-based bottle list with card grid
- [x] **8.3** Clean up Dashboard to be a simple overview

### Phase 9: Bottle Cards & Quick Actions
- [ ] **9.1** Visual bottle cards with status badges, size, Wine version
- [ ] **9.2** Right-click / context menu: Configure, Launch, Open C:\, Delete
- [ ] **9.3** Drag-and-drop .exe onto a bottle to install

### Phase 10: Library Redesign
- [ ] **10.1** App cards with icons, not table rows
- [ ] **10.2** Search/filter bar
- [ ] **10.3** Launch count, last played, play time badges

### Phase 11: Simplify Configuration
- [ ] **11.1** Replace technical settings screens with simple per-bottle toggles
- [ ] **11.2** Graphics backend: Auto / DXVK / D3DMetal (when available)
- [ ] **11.3** Wine version: pick from installed runtimes
- [ ] **11.4** Hide advanced options behind an "Advanced" expander

### Phase 12: macOS Native Polish
- [ ] **12.1** System font stack, proper titlebar integration
- [ ] **12.2** Smooth transitions, native scroll behavior
- [ ] **12.3** Touch Bar / Shortcuts integration
- [ ] **12.4** Menu bar extra for quick launch
