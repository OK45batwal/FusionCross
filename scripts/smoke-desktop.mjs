import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Debug builds alone support this override. Never use a release binary here.
const binary = fileURLToPath(new URL("../src-tauri/target/debug/bundle/macos/FusionCross.app/Contents/MacOS/fusioncross", import.meta.url));
const dataDir = await mkdtemp(join(tmpdir(), "fusioncross-desktop-smoke-"));
const child = spawn(binary, [], {
  env: { ...process.env, FUSIONCROSS_DATA_DIR: dataDir },
  stdio: ["ignore", "inherit", "inherit"],
});
let stopped = false;
let spawnError;
const closed = new Promise((resolve) => {
  child.on("error", (error) => { spawnError = error; });
  child.on("close", () => { stopped = true; resolve(); });
});
try {
  let state;
  for (let attempt = 0; attempt < 40; attempt++) {
    await delay(250);
    if (spawnError) throw spawnError;
    assert.ok(!stopped, "Desktop exited during startup");
    try { state = JSON.parse(await readFile(join(dataDir, "state.json"), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (state) break;
  }
  assert.equal(state?.schema_version, 3, "Desktop did not initialize its isolated library");
  assert.deepEqual(state.bottles, []);
  assert.deepEqual(state.applications, []);
  await delay(5000);
  assert.ok(!stopped, "Desktop exited after library initialization");
  console.log("PASS: native app startup, isolated library initialization, and process liveness.");
  console.log("This checks startup only, not rendered UI or native IPC interactions.");
} finally {
  if (!stopped && child.pid) {
    child.kill("SIGTERM");
    const killTimer = setTimeout(() => { if (!stopped) child.kill("SIGKILL"); }, 3000);
    await closed;
    clearTimeout(killTimer);
  }
  console.log(`Disposable test data retained for inspection: ${dataDir}`);
}
