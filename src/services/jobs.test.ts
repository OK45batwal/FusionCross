import { afterEach, expect, it, vi } from "vitest";
import { listJobs } from "./tauri";
import { waitForJob } from "./jobs";

vi.mock("./tauri", () => ({ listJobs: vi.fn() }));
afterEach(() => vi.useRealTimers());
it("accepts the backend's lowercase terminal status", async () => {
  vi.mocked(listJobs).mockResolvedValue([{ id: "job", title: "Install", status: "done", can_cancel: false, message: "Installed" }]);
  await expect(waitForJob("job", new AbortController().signal, vi.fn())).resolves.toBe("Installed");
});
it("stops polling when the view is unmounted", async () => {
  vi.useFakeTimers();
  vi.mocked(listJobs).mockResolvedValue([{ id: "job", title: "Install", status: "running", can_cancel: true }]);
  const controller = new AbortController();
  const result = waitForJob("job", controller.signal, vi.fn());
  const rejected = expect(result).rejects.toThrow("cancel waiting");
  await Promise.resolve();
  controller.abort(new Error("cancel waiting"));
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
it("reports timeout instead of declaring a long-running installation successful", async () => {
  vi.useFakeTimers();
  vi.mocked(listJobs).mockResolvedValue([{ id: "job", title: "Install", status: "running", can_cancel: true }]);
  const result = waitForJob("job", new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toThrow("may still be running");
  await vi.runAllTimersAsync();
  await rejected;
});
it("never treats a missing or cancelled job as success", async () => {
  vi.mocked(listJobs).mockResolvedValue([]);
  await expect(waitForJob("job", new AbortController().signal, vi.fn())).rejects.toThrow("no longer available");
  vi.mocked(listJobs).mockResolvedValue([{ id: "job", title: "Install", status: "cancelled", can_cancel: false }]);
  await expect(waitForJob("job", new AbortController().signal, vi.fn())).rejects.toThrow("cancelled");
});
