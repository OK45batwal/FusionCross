# Mac verification report — 2026-10-14

## Implemented in this improvement pass

- Phase 2 follow-ups: supervised installer/download cancellation, consistent string job statuses, global background-task feedback, and an opt-in real Wine smoke test.
- Phase 3: centralized library synchronization and failure recovery, lazy-loaded views, view error boundaries, accessible modal semantics, listener cleanup, shared installation polling, and frontend regression tests.
- Phase 4 code: dependency updates, unverified runtime download gating, minimum OS alignment, release prerequisite checks, and a signed/notarized universal release workflow that produces drafts and checksums.

Phase 4 distribution sign-off is **not complete**: real credentials, verified runtime artifacts, and release-device testing remain prerequisites. No release tag or public release was created by this pass.

## Local evidence

Host reported macOS 27.0.1 (26A434), arm64. The installed runtime reported Wine 11.0; Wine's device output identified Apple M5.

| Check | Result and boundary |
| --- | --- |
| `npm run verify` | ESLint, frontend unit/component tests, Rust formatting, strict Clippy, Rust tests, TypeScript, and production bundle pass. Final counts: 9 frontend tests, 53 ordinary Rust tests; real Wine test opt-in. |
| WebKit browser tests | 4 passed: startup recovery, failed sync without false success, command-palette focus/Escape, and unverified runtime download gating. These tests mock Tauri IPC. |
| Real Wine smoke test | Passed: initialized a fresh prefix, ran `cmd /c echo`, verified output logging and successful session exit, and verified no tracked process remained. Its temporary prefix was removed and its wineserver stopped. No existing bottles were modified. |
| Debug Mac `.app` packaging | Passed. Output: `src-tauri/target/debug/bundle/macos/FusionCross.app`. |
| Native startup smoke | Passed: app initialized schema v3 in a new temporary library and remained alive; the test then terminated its own process. This is not a visual or IPC flow assertion. |
| npm dependency audit | 0 reported vulnerabilities after compatible dependency updates. This is a dated npm result, not a guarantee about all dependencies. |
| Release preflight | Package/Cargo/Tauri versions, minimum OS, and CSP checks passed. Signing helper shell syntax checked. |
| Initial frontend JS | 261.13 kB (79.73 kB gzip), with views split into separate lazy chunks. |

## Outstanding release verification

- Developer ID signing and Apple notarization were not run: local keychain inspection returned zero valid signing identities. Configure the secrets described in [RELEASE.md](RELEASE.md), then exercise the release workflow.
- Native GUI clicking/visual inspection was not performed: the required Computer Use `node_repl` tool was unavailable. Browser WebKit tests are not a substitute for the complete native bridge.
- Intel hardware, the macOS 13 minimum, clean-machine Gatekeeper behavior, real vendor installers, application graphics/gameplay, and real-bottle clone/snapshot restore still require the manual test matrix.
- Runtime catalogs remain import-only until actual macOS binary artifacts and verified hashes are selected. This intentionally prevents unsupported or unverified downloads.
- Cancellation stops supervised process groups. It is not an uninstall/rollback operation and does not promise cleanup of Wine processes that detach from that group.
