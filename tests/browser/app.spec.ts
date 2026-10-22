import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = { schema_version: 3, applications: [] as unknown[], bottles: [] as unknown[], runtimes: [], snapshots: [], settings: [] };
    const params = new URL(window.location.href).searchParams;
    if (params.has("app")) {
      state.applications.push({
        id: "app-1",
        bottle_id: "bottle-1",
        name: "Neon Drift",
        executable_path: "C:\\Games\\neon.exe",
        category: "game",
        favorite: false,
        launch_count: 0,
        play_time_mins: 0,
        last_played: null,
        compatibility: null,
        profile: null,
        icon_data: null,
        launch_arguments: null,
      });
    }
    const control = { failState: params.has("failState") };
    const catalogItem = {
      id: "neon-drift",
      title: "Neon Drift",
      developer: "Test Studio",
      category: "Action & RPG",
      tier: "Gold",
      compatibility: 90,
      graphics_backend: "dxvk",
      windows_version: "win10",
      directx_version: "11",
      msync_recommended: false,
      dependencies: [],
      launch_arguments: [],
      installer_url: "https://example.com/NeonDrift.msi",
      cover_url: null,
      notes: "Test entry",
      anti_cheat_status: "Supported",
    };
    Object.assign(window, {
      testControl: control,
      __TAURI_INTERNALS__: {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: Record<string, string>) => {
          switch (command) {
            case "get_state": if (control.failState) throw { message: "Test connection unavailable" }; return structuredClone(state);
            case "get_system_info": return { app_version: "2.0.0", arch: "aarch64", os: "macos", engines: [] };
            case "get_templates": return [{ type: "gaming", label: "Gaming", description: "Games", windows_version: "win10", graphics: "automatic", dependencies: [] }];
            case "get_recovery_notice": return null;
            case "list_running": case "list_jobs": return [];
            case "get_game_catalog": return [catalogItem];
            case "export_app_bundle": return "/tmp/Neon Drift.app";
            case "install_catalog_game": return "abcdef1234567890";
            case "get_runtimes": return [{ id: "unverified", name: "Unverified runtime", category: "wine", downloaded: false, version: "", path: "", url: "https://example.com/releases", sha256: "", download_available: false }];
            case "create_bottle": {
              const bottle = { id: "test-bottle", name: args.name, path: "/test/bottle", windows_version: "win10", graphics: "automatic", runtime: "Test Wine", prefix_type: "gaming", environment: [], dll_overrides: [], dependencies: [] };
              state.bottles.push(bottle);
              return bottle;
            }
            default:
              if (command.startsWith("plugin:event|") || command.startsWith("plugin:window|")) return 1;
              throw new Error(`Unexpected IPC command: ${command}`);
          }
        },
      },
    });
  });
});

test("startup failure offers retry and loads the library after recovery", async ({ page }) => {
  await page.goto("/?failState=1");
  await expect(page.getByRole("heading", { name: "Your library could not load" })).toBeVisible();
  await page.evaluate(() => { (window as any).testControl.failState = false; });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("button", { name: /All Applications/ })).toBeVisible();
});

test("failed sync retains the library and never reports success", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /All Applications/ })).toBeVisible();
  await page.evaluate(() => { (window as any).testControl.failState = true; });
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByText(/Showing the last loaded library/)).toBeVisible();
  await expect(page.getByText("Application state synchronized successfully.")).toHaveCount(0);
});

test("command palette supports keyboard navigation, focus containment, and Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /All Applications/ })).toBeVisible();
  await page.keyboard.press("Meta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search commands" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.querySelector("dialog")?.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("lazy runtime view disables unverified downloads", async ({ page }) => {  await page.goto("/");
  await page.getByRole("button", { name: /Runtimes/ }).click();
  await expect(page.getByRole("heading", { name: "Runtime Engine Manager" })).toBeVisible();
  await expect(page.getByText("Import only — no verified download")).toBeVisible();
  await expect(page.getByTitle("Download & install runtime")).toHaveCount(0);
});

test("exporting an application reports the created bundle path", async ({ page }) => {
  await page.goto("/?app=1");
  await page.getByTitle("Options").click();
  await page.getByRole("button", { name: "Export as Mac App" }).click();
  await expect(page.getByText("Exported to /tmp/Neon Drift.app")).toBeVisible();
});

test("catalog install starts a background job for the selected game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Game Catalog/ }).click();
  await page.getByText("Neon Drift", { exact: true }).click();
  await page.getByRole("button", { name: "Install Neon Drift" }).click();
  await expect(page.getByText(/Job #abcdef12 started in background/)).toBeVisible();
});
