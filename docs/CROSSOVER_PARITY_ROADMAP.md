# FusionCross — CrossOver Parity Roadmap

> Vision: Transform FusionCross into the premier, free & open-source macOS Windows application runner competing directly with CodeWeavers CrossOver Mac on Apple Silicon (M1–M4+).

---

## 📊 Competitive Architecture Comparison

| Feature / Capability | CodeWeavers CrossOver Mac | FusionCross Target (v2.x - v3.0) |
| :--- | :--- | :--- |
| **macOS Engine Architecture** | Wine-CX (Custom Patched) + Rosetta 2 | Wine-GE / Proton-GE / Wine-CX Engine Manager |
| **DirectX 11/12 Graphics** | D3DMetal (GPTK) & DXVK Metal | D3DMetal 2.0 + DXVK-Native + MetalFX Upscaling |
| **App Bundle Integration** | Native macOS `.app` shortcuts | Native macOS Finder `.app` Generator with Dock Icons |
| **Dependency Resolution** | Crosstie Database | `.fusionrecipe` Engine + Automated Winetricks Verbs |
| **Prefix Cloning & Snapshots** | Manual prefix folder copy | APFS Copy-on-Write Instant Snapshots & Rollback |
| **Game Controllers** | GameController.framework (SDL2) | Native Apple GameController.framework (DualSense/Xbox) |
| **Diagnostics & Troubleshooting** | CXDiag / Manual Log Viewer | Autonomous 3-Part Health Diagnostics & 1-Click Auto-Fix |
| **Pricing & License** | $64 / year (Commercial) | **100% Free & Open Source (MIT License)** |

---

## 🚀 6-Phase Engineering Roadmap

```
Phase 1: Apple Silicon Graphics & Upscaling Pipeline
  ├── Integration of D3DMetal 2.0 (Apple Game Porting Toolkit 2)
  ├── MetalFX Spatial & Temporal Upscaling Toggle
  └── DXVK-Native + MoltenVK Vulkan translation layer tuning

Phase 2: Deep macOS Desktop Integration
  ├── Automated `.app` bundle generator (Creates standard macOS apps in ~/Applications)
  ├── macOS Dock & Spotlight search integration
  └── Retinal high-DPI icon extraction & vector scaling

Phase 3: Crosstie-Parity Recipe & Dependency Engine
  ├── Automated Winetricks/Verb dependency solver (VC++ 2015-2022, .NET 4.8, DirectX, GDI+)
  ├── Online & Offline `.fusionrecipe` metadata catalog
  └── Dry-run dependency validator with SHA-256 checksum caching

Phase 4: Advanced Bottle Management & APFS Copy-on-Write Snapshots
  ├── Zero-cost APFS clone system for instant prefix branching
  ├── Delta snapshot backup & 1-click state rollback
  └── Prefix environment variable manager (`WINEDLLOVERRIDES`, `VK_ICD_FILENAMES`)

Phase 5: Gaming Input & Low-Latency Audio Subsystem
  ├── DirectInput / XInput mapping to Apple GameController.framework
  ├── DualSense haptics & Xbox impulse trigger pass-through
  └── CoreAudio low-latency buffer management (XAudio2 driver)

Phase 6: Autonomous Diagnostic & Self-Healing Engine
  ├── Automated `WINEDEBUG` log parser & exception classifier
  ├── PE binary dependency analyzer (`PE-Imports` inspector)
  └── 1-Click self-healing Auto-Fix for 50+ common Windows runtime crashes
```

---

## 🛠 Detailed Milestone Specifications

### Milestone 1: Apple Silicon Graphics Acceleration (Q3 2026)
- **D3DMetal 2.0 Engine**: Upgrade graphics pipeline to support DirectX 12 Agility SDK and Shader Model 6.6 via Apple GPTK 2.
- **MetalFX Upscaling**: Integrate MetalFX spatial & temporal upscaling controls to double frame rates in 4K games on Apple M-series chips.
- **Micro-Stutter Reduction**: Implement asynchronous shader compilation for DXVK to eliminate first-render stuttering.

### Milestone 2: Native macOS Finder Integration (Q3 2026)
- **App Bundle Generator**: Create standard `.app` directory structures under `~/Applications/FusionCross/` containing launcher scripts and icon resources.
- **Icon Converter**: Automatically convert Windows PE `.ico` resources to high-resolution macOS `.icns` / `.png` retina assets.
- **File Association**: Register Windows file extensions (e.g. `.docx`, `.psd`, `.exe`) directly with macOS Finder.

### Milestone 3: Recipe & Dependency Engine (Q4 2026)
- **Winetricks Integration**: Embed a sandboxed Winetricks runner capable of installing `vcrun2022`, `dotnet48`, `corefonts`, `d3dcompiler_47`, and `physx`.
- **Recipe Repository**: Host an open community database of verified configuration recipes (`.fusionrecipe` files) on GitHub.

### Milestone 4: APFS Instant Snapshots (Q4 2026)
- **APFS Copy-on-Write**: Utilize macOS `clonefile()` syscalls for 0-second, 0-byte initial prefix duplication.
- **Snapshot Manager**: Provide 1-click restore points before installing experimental patches or mod packages.

---

## 🎯 Verification & Quality Benchmarks

1. **Compatibility Score**: Achieve 90%+ compatibility score across top 100 Windows productivity apps & Steam DirectX 11/12 titles.
2. **Launch Time**: Sub-2-second launch time for secondary application runs.
3. **Zero Friction Guarantee**: 100% of common launch crashes resolved via 1-click Auto-Fix.
