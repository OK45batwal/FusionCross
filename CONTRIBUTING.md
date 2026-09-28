# Contributing to FusionCross

Thank you for your interest in contributing to FusionCross! We are building the gold standard for running Windows software and games on Apple Silicon macOS — 100% free, privacy-first, and native.

---

## Code of Conduct

Everyone participating in the FusionCross project is expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior via the channels outlined in our [Security Policy](SECURITY.md).

---

## Ways to Contribute

1. **Game & Software Compatibility Recipes**: Report test results or add recipes for games in `src-tauri/src/compatibility.rs`.
2. **Bug Reports & Diagnostics**: Help isolate issues with specific Windows applications, runtimes, or graphics engines.
3. **Core Development**: Improve Wine runtime orchestration, PE analysis, D3DMetal/DXVK translations, or the macOS HIG user interface.
4. **Documentation**: Improve setup guides, troubleshooting articles, and compatibility tips.

---

## Development Setup

### Prerequisites

- **macOS 13.0 (Ventura) or newer** running on Apple Silicon (M1/M2/M3/M4).
- **Rust Toolchain**: `rustup` with stable Rust (`rustc 1.80+`).
- **Node.js**: v20 or newer with `npm`.
- **Xcode Command Line Tools**: `xcode-select --install`.
- **Wine Runtime**: `brew install --cask --no-quarantine wine-stable` or an installed Whisky / CrossOver runtime.

### Initializing the Project

```bash
# 1. Clone the repository
git clone https://github.com/OK45batwal/FusionCross.git
cd FusionCross

# 2. Install frontend dependencies
npm install

# 3. Run desktop development app with live reload
npm run tauri dev
```

---

## Testing & Quality Gates

All pull requests must pass the following continuous integration checks:

### 1. Rust Backend Checks
```bash
# Run unit tests (32+ tests covering state, PE parsing, icons, security)
cargo test --manifest-path src-tauri/Cargo.toml

# Check code formatting
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# Run Clippy with zero warnings allowed
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### 2. Frontend Checks
```bash
# Run ESLint across React / TypeScript codebase
npm run lint

# Verify TypeScript type definitions without emitting
npx tsc --noEmit

# Production Vite build check
npm run build
```

---

## How to Add or Update Game Compatibility Recipes

Game profiles and 1-click recipes live in `src-tauri/src/compatibility.rs`.

Each entry defines:
- **Identifier & Title**: `id`, `title`, `developer`, `category`
- **Compatibility Tier**: `"Platinum"`, `"Gold"`, `"Silver"`, or `"Blocked"`
- **Graphics Backend**: `"d3dmetal"`, `"dxvk"`, or `"dxmt"`
- **Performance Settings**: `msync_recommended: bool`, `hud_recommended: bool`
- **Dependencies**: e.g., `vec!["vcrun2022", "d3dcompiler_47"]`
- **Installer URL**: Direct official installer or launcher link if publicly distributable.

Example:
```rust
GameCatalogItem {
    id: "hades2",
    title: "Hades II",
    developer: "Supergiant Games",
    category: "Action Roguelike",
    tier: "Platinum",
    notes: "Flawless out-of-the-box performance on Apple Silicon using D3DMetal and MSync.",
    graphics_backend: "d3dmetal",
    msync_recommended: true,
    hud_recommended: false,
    recommended_runtime: "Whisky-Wine (Apple GPTK)",
    dependencies: vec!["vcrun2022"],
    installer_url: Some("https://store.steampowered.com/app/1145350/Hades_II/"),
}
```

---

## Commit Guidelines (Conventional Commits)

We use Conventional Commits to generate automated changelogs and release notes:

- `feat(scope)`: A new feature or user-facing capability (e.g. `feat(catalog): add 20 modern games to recipe database`)
- `fix(scope)`: A bug fix (e.g. `fix(scanner): exclude uninstaller and helper executables`)
- `refactor(scope)`: Code restructuring without functional changes
- `docs(scope)`: Documentation improvements
- `style(scope)`: Code formatting, CSS tokens, rustfmt adjustments
- `test(scope)`: Adding or updating test suites
- `chore(scope)`: Maintenance, build tools, dependency updates

---

## Pull Request Process

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`).
2. Make surgical, well-tested changes following Apple HIG and Rust best practices.
3. Ensure all tests and linting pass locally (`cargo test`, `cargo clippy`, `npm run lint`).
4. Push your branch to GitHub and open a Pull Request against `main`.
5. Clearly describe the problem, the solution, and attach screenshots or test telemetry where applicable.
