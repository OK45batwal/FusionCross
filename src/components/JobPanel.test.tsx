import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JobPanel } from "./JobPanel";
import { cancelJob, listJobs } from "../services/tauri";

vi.mock("../services/tauri", () => ({ listJobs: vi.fn(), cancelJob: vi.fn() }));
afterEach(() => vi.useRealTimers());

it("cancels an active job and refreshes only once when it becomes terminal", async () => {
  vi.useFakeTimers();
  vi.mocked(listJobs).mockResolvedValue([{ id: "install", title: "Install app", status: "running", can_cancel: true }]);
  vi.mocked(cancelJob).mockResolvedValue(undefined);
  const onCompleted = vi.fn().mockResolvedValue(undefined);
  await act(async () => { render(<JobPanel onCompleted={onCompleted} />); });
  fireEvent.click(screen.getByText("Background tasks (1 active)"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel Install app" })); });
  expect(cancelJob).toHaveBeenCalledWith("install");
  vi.mocked(listJobs).mockResolvedValue([{ id: "install", title: "Install app", status: "cancelled", can_cancel: false, message: "Cancelled" }]);
  await act(() => vi.advanceTimersByTimeAsync(1500));
  expect(screen.queryByRole("button", { name: "Cancel Install app" })).not.toBeInTheDocument();
  expect(onCompleted).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1500));
  expect(onCompleted).toHaveBeenCalledTimes(1);
});
