## Description

<!-- Describe your changes clearly. Include motivation, context, and issue references if applicable. -->

Fixes #(issue)

## Type of Change

- [ ] 🚀 New feature (non-breaking change which adds functionality)
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] 🎮 Compatibility / Recipe addition or update
- [ ] 🎨 UI / Apple HIG improvement
- [ ] ⚡ Performance improvement
- [ ] 📝 Documentation update

## Checklist

- [ ] I have tested my changes on macOS Apple Silicon.
- [ ] Backend tests pass (`cargo test --manifest-path src-tauri/Cargo.toml`).
- [ ] Rust formatting check passes (`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`).
- [ ] Clippy passes with zero warnings (`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`).
- [ ] Frontend linter passes (`npm run lint`).
- [ ] TypeScript typecheck passes (`npx tsc --noEmit`).
- [ ] Production build succeeds (`npm run build`).
- [ ] My commits follow [Conventional Commits](https://www.conventionalcommits.org/).

## Screenshots / Verification

<!-- If applicable, add screenshots or terminal logs verifying your changes -->
