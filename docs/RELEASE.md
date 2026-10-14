# Release and platform checklist

## Support boundary

- Minimum configured OS: macOS 13.0.
- Local validation: Apple Silicon arm64. See [Mac test evidence](MAC_TEST_REPORT.md).
- The release workflow builds a universal Apple Silicon/Intel application. An Intel build is not evidence that every runtime or graphics backend works on Intel. Test it on Intel hardware before making compatibility claims.
- Wine runtimes are external executables, not a security sandbox. Only import trusted macOS-compatible archives. Importing probes the contained executable with `--version`.
- Built-in runtime entries currently lack verified, packaged macOS artifacts and pinned SHA-256 values. They are explicitly import-only. Automatic downloads remain disabled until a maintainer selects and verifies distributable artifacts. Never invent hashes or enable a source tarball/release-page URL as a binary download.

## Local gates

Use Node 22.13+ (22 LTS) or 24+, stable Rust, and Xcode Command Line Tools.

```sh
npm ci
npm run verify
npm audit --audit-level=high
npx playwright install webkit
npm run test:e2e
npm run release:check
npm run tauri build -- --debug --bundles app
npm run test:desktop
```

`test:desktop` launches only the debug app, sets `FUSIONCROSS_DATA_DIR` to a newly created temporary directory, checks schema initialization and process liveness, and terminates its own test process. It retains the test directory for inspection. Release builds ignore the override. This is not a visual UI or real IPC end-to-end test.

## Signing prerequisites

Configure the following GitHub Actions repository secrets through GitHub's settings, never in source control:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application certificate and private key exported as `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting that export |
| `APPLE_SIGNING_IDENTITY` | Full `Developer ID Application: …` identity |
| `APPLE_ID` | Developer account email used for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization, not the account login password |
| `APPLE_TEAM_ID` | Developer team identifier |

Follow [Tauri's macOS signing and notarization guide](https://v2.tauri.app/distribute/sign/macos/) to obtain the certificate and configure credentials. This project has no embedded credentials. Local inspection during the implementation found no valid signing identities; the signed workflow has not been exercised.

## Distribution flow

1. Keep the package, Cargo, and Tauri versions identical. The release tag must be exactly `v<version>`.
2. Push the version tag, or dispatch the Release workflow against that tag. Dispatching against a branch is intentionally rejected.
3. The workflow runs tests and the npm vulnerability audit, imports the distribution identity into a temporary runner keychain, and builds universal app/DMG bundles.
4. It verifies the app signature, app notarization ticket, and Gatekeeper assessment. If the DMG does not have its own ticket, it submits the DMG and staples a ticket before validating it.
5. It generates `SHA256SUMS.txt` from the final DMGs and creates a **draft** release. Any failed gate stops publication preparation. The temporary certificate/keychain are removed on completion or failure.
6. On clean Apple Silicon and Intel machines, verify the download checksum, mount the DMG, launch through Finder, and exercise create/install/launch/stop/clone/restore flows with disposable data. Test offline launch to confirm ticket stapling. Only then publish the reviewed draft.

The npm audit gate does not substitute for Rust dependency/security review. CI checks configured here do not prove compatibility of arbitrary Windows games, vendor installers, or detached Wine services.
