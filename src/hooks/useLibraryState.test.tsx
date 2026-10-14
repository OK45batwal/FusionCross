import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useLibraryState } from "./useLibraryState";
import * as api from "../services/tauri";

vi.mock("../services/tauri", () => ({ getState: vi.fn(), getSystemInfo: vi.fn(), getTemplates: vi.fn(), listRunning: vi.fn(), getRecoveryNotice: vi.fn() }));
const state: api.AppState = { schema_version: 3, applications: [], bottles: [], runtimes: [], snapshots: [], settings: [] };
beforeEach(() => {
  vi.mocked(api.getState).mockResolvedValue(state);
  vi.mocked(api.getSystemInfo).mockResolvedValue({ app_version: "2", arch: "aarch64", os: "macos", engines: [] });
  vi.mocked(api.getTemplates).mockResolvedValue([]);
  vi.mocked(api.listRunning).mockResolvedValue([]);
  vi.mocked(api.getRecoveryNotice).mockResolvedValue(null);
});

it("shows an initial error and recovers on retry", async () => {
  vi.mocked(api.getState).mockRejectedValueOnce({ message: "Permission denied" });
  const { result } = renderHook(useLibraryState);
  await waitFor(() => expect(result.current.error).toBe("Permission denied"));
  expect(result.current.state).toBeNull();
  await act(() => result.current.refreshState());
  expect(result.current.state).toEqual(state);
  expect(result.current.error).toBeNull();
});

it("keeps the last good library and rejects failed manual sync", async () => {
  const { result } = renderHook(useLibraryState);
  await waitFor(() => expect(result.current.state).toEqual(state));
  vi.mocked(api.getState).mockRejectedValueOnce(new Error("Disconnected"));
  await act(async () => { await expect(result.current.refreshState()).rejects.toThrow("Disconnected"); });
  expect(result.current.state).toEqual(state);
  expect(result.current.error).toBe("Disconnected");
});

it("does not overwrite a newer response with an older refresh", async () => {
  const { result } = renderHook(useLibraryState);
  await waitFor(() => expect(result.current.state).toEqual(state));
  let resolveOld!: (state: api.AppState) => void;
  vi.mocked(api.getState).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  let older!: Promise<void>;
  act(() => { older = result.current.refreshState(); });
  const newer = { ...state, settings: [["safe_mode", "on"]] as [string, string][] };
  vi.mocked(api.getState).mockResolvedValueOnce(newer);
  await act(() => result.current.refreshState());
  await act(async () => { resolveOld(state); await older; });
  expect(result.current.state).toEqual(newer);
});
