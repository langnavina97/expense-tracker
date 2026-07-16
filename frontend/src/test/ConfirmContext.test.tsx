import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider, useConfirm } from "../context/ConfirmContext";

function TestConsumer() {
  const confirm = useConfirm();
  const [result, setResult] = useState<string>("none");

  async function ask() {
    const answer = await confirm("Are you sure?");
    setResult(answer ? "confirmed" : "cancelled");
  }

  return (
    <div>
      <div data-testid="result">{result}</div>
      <button onClick={ask}>ask</button>
    </div>
  );
}

describe("ConfirmProvider", () => {
  it("resolves true when Confirm is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    );

    await user.click(screen.getByText("ask"));
    expect(await screen.findByText("Are you sure?")).toBeInTheDocument();

    await user.click(screen.getByText("Confirm"));

    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("confirmed"));
  });

  it("resolves false when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    );

    await user.click(screen.getByText("ask"));
    await user.click(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("cancelled"));
  });

  it("resolves false when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    );

    await user.click(screen.getByText("ask"));
    const backdrop = container.querySelector(".modal-backdrop");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("cancelled"));
  });
});

describe("useConfirm", () => {
  it("throws when used outside a ConfirmProvider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow("useConfirm must be used within a ConfirmProvider");

    consoleErrorSpy.mockRestore();
  });
});
