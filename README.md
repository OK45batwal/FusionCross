# FusionCross (CrossOver-style Wine launcher for macOS)

FusionCross is a Tauri desktop app that manages isolated Wine bottles and runs real Windows installers (`.exe` / `.msi`) on macOS.

## What works now

- Real per-bottle prefix creation under:
  - `~/Library/Application Support/FusionCross/bottles`
- Wine prefix initialization (`wineboot -i`) when creating/resetting bottles
- Real installer execution through Wine
- Real app launch from discovered executable paths
- Winetricks dependency installs (when `winetricks` is installed)
- Persistent app state in:
  - `~/Library/Application Support/FusionCross/state.json`

## Requirements (macOS)

- Homebrew
- Wine:

```bash
brew install --cask --no-quarantine wine-stable
```

- Optional but recommended:

```bash
brew install winetricks
```

## Development

Install dependencies:

```bash
npm install
```

Run web UI only:

```bash
npm run dev
```

Run desktop app (Tauri):

```bash
npm run tauri dev
```

Build production assets:

```bash
npm run build
```

Run backend tests:

```bash
cd src-tauri && cargo test
```

## Real install flow (like CrossOver)

1. Create or select a bottle.
2. Choose **Custom Install** in the wizard.
3. Provide an absolute path to a real Windows installer (`.exe` or `.msi`).
4. Wait for installer completion logs.
5. Scan apps in the bottle and register the discovered executable in Library.
6. Launch from Library.

## Notes

- Preset recipes are templates for bottle configuration; they are not bundled installers.
- If Wine is missing, the app now surfaces explicit errors instead of fake success logs.
