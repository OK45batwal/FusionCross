# Security Policy

FusionCross is designed with security and privacy as core priorities. Because running Windows binaries on macOS involves complex containerization and IPC translation, we maintain strict architectural safeguards to protect user systems.

---

## Supported Versions

| Version | Supported |
|:---|:---|
| 2.0.x | :white_check_mark: Yes |
| 1.x.x | :x: No (End of Life) |

---

## Security Architecture & Safeguards

FusionCross implements multiple defense-in-depth measures:

1. **Prefix Sandboxing**: Each bottle is isolated within its own dedicated prefix directory under `~/Library/Application Support/FusionCross/bottles/`.
2. **Symlink Boundary Checks**: Path sanitization strictly enforces that Windows virtual file system paths cannot escape through `dosdevices/z:` or symlink traversals into host root directories.
3. **Checksum Verification**: All downloaded runtime archives (Wine engines, DXVK tarballs) are verified using SHA-256 before extraction.
4. **Archive Tar-Bomb Protection**: Archive extractors validate relative paths to prevent directory traversal (`../`) and unauthorized host file overwrites.
5. **No Telemetry by Default**: FusionCross does not collect or transmit user process telemetry, installed software lists, or system fingerprints.

---

## Reporting a Vulnerability

If you discover a security vulnerability or sandbox escape in FusionCross, please **do not report it via a public GitHub issue**.

Instead, please send a report to:
- **Email**: `security@fusionstudios.dev` (or open a private [GitHub Security Advisory](https://github.com/OK45batwal/FusionCross/security/advisories/new))

### What to include in your report:
- A clear description of the vulnerability and its potential impact.
- Exact steps to reproduce the issue or a minimal proof-of-concept.
- Your macOS version, Apple Silicon model, and FusionCross version.

We commit to acknowledging your report within **48 hours** and keeping you updated on the remediation and release timeline.
