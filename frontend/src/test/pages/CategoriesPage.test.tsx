import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriesPage } from "../../pages/CategoriesPage";
import { ToastProvider } from "../../context/ToastContext";
import { ConfirmProvider } from "../../context/ConfirmContext";
import { api, ApiError } from "../../api";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      getCategories: vi.fn(),
      createCategory: vi.fn(),
      renameCategory: vi.fn(),
      deleteCategory: vi.fn(),
    },
  };
});

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <CategoriesPage />
      </ConfirmProvider>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.mocked(api.getCategories).mockReset();
  vi.mocked(api.createCategory).mockReset();
  vi.mocked(api.renameCategory).mockReset();
  vi.mocked(api.deleteCategory).mockReset();
});

describe("CategoriesPage", () => {
  it("shows an empty state when there are no categories", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([]);
    renderPage();

    expect(await screen.findByText("No categories yet.")).toBeInTheDocument();
  });

  it("lists existing categories", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([
      { id: 1, name: "Food", householdId: 1 },
      { id: 2, name: "Travel", householdId: 1 },
    ]);
    renderPage();

    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
  });

  it("adds a new category", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([]);
    vi.mocked(api.createCategory).mockResolvedValueOnce({ id: 1, name: "Food", householdId: 1 });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No categories yet.");

    await user.type(screen.getByPlaceholderText("New category name"), "Food");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(api.createCategory).toHaveBeenCalledWith({ name: "Food" });
  });

  it("renames a category", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([{ id: 1, name: "Food", householdId: 1 }]);
    vi.mocked(api.renameCategory).mockResolvedValueOnce({ id: 1, name: "Groceries", householdId: 1 });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Food");

    await user.click(screen.getByText("Rename"));
    const input = screen.getByDisplayValue("Food");
    await user.clear(input);
    await user.type(input, "Groceries");
    await user.click(screen.getByText("Save"));

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(api.renameCategory).toHaveBeenCalledWith(1, { name: "Groceries" });
  });

  it("deletes a category after confirming", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([{ id: 1, name: "Food", householdId: 1 }]);
    vi.mocked(api.deleteCategory).mockResolvedValueOnce({ message: "ok" });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Food");

    await user.click(screen.getByText("Delete"));
    await user.click(await screen.findByText("Confirm"));

    await waitFor(() => expect(screen.queryByText("Food")).not.toBeInTheDocument());
    expect(api.deleteCategory).toHaveBeenCalledWith(1);
  });

  it("doesn't delete a category if the confirmation is cancelled", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([{ id: 1, name: "Food", householdId: 1 }]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Food");

    await user.click(screen.getByText("Delete"));
    await user.click(await screen.findByText("Cancel"));

    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(api.deleteCategory).not.toHaveBeenCalled();
  });

  it("shows a toast if deleting fails", async () => {
    vi.mocked(api.getCategories).mockResolvedValueOnce([{ id: 1, name: "Food", householdId: 1 }]);
    vi.mocked(api.deleteCategory).mockRejectedValueOnce(new ApiError(500, "Something broke."));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Food");

    await user.click(screen.getByText("Delete"));
    await user.click(await screen.findByText("Confirm"));

    expect(await screen.findByText("Something broke.")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("shows an inline error if categories fail to load", async () => {
    vi.mocked(api.getCategories).mockRejectedValueOnce(new ApiError(500, "Couldn't reach the server."));
    renderPage();

    expect(await screen.findByText("Couldn't reach the server.")).toBeInTheDocument();
  });
});
