import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CreateBottleDialog } from "./CreateBottleDialog";
import { createBottle, type BottleTemplate } from "../services/tauri";

vi.mock("../services/tauri", () => ({ createBottle: vi.fn() }));
const templates = [{ type: "gaming", label: "Gaming", description: "Games" }] as BottleTemplate[];
it("keeps failed creation visible and does not dismiss the dialog", async () => {
  vi.mocked(createBottle).mockRejectedValue({ message: "Disk is full" });
  const onCreated = vi.fn();
  render(<CreateBottleDialog templates={templates} onClose={vi.fn()} onCreated={onCreated} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Bottle Name"), "Test bottle");
  await user.click(screen.getByRole("button", { name: "Create Bottle" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Disk is full"));
  expect(onCreated).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Create Bottle" })).toBeEnabled();
});
