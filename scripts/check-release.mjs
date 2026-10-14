import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const packageInfo = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const tauri = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url)));
const cargo = readFileSync(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
assert.equal(tauri.version, packageInfo.version, "Frontend and Tauri versions differ");
assert.equal(cargo.match(/^version = "([^"]+)"/m)?.[1], packageInfo.version, "Rust and frontend versions differ");
assert.equal(tauri.bundle.macOS.minimumSystemVersion, "13.0", "Supported macOS baseline differs from release documentation");
assert.ok(tauri.app.security.csp, "Production CSP must be enabled");
if (process.argv.includes("--require-signing")) {
  for (const key of ["APPLE_CERTIFICATE", "APPLE_CERTIFICATE_PASSWORD", "APPLE_SIGNING_IDENTITY", "APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"]) {
    assert.ok(process.env[key]?.trim(), `Missing required release secret: ${key}`);
  }
  assert.match(process.env.APPLE_SIGNING_IDENTITY, /^Developer ID Application:/, "Distribution requires a Developer ID Application identity");
  assert.equal(process.env.GITHUB_REF_TYPE, "tag", "Select a version tag when dispatching the release workflow");
  assert.equal(process.env.GITHUB_REF_NAME, `v${packageInfo.version}`, "Release tag must match the application version");
}
console.log(`Release configuration verified for FusionCross ${packageInfo.version}. Signing and notarization must pass before publication.`);
