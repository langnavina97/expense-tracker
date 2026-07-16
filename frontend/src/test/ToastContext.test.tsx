import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../context/ToastContext";

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Something failed")}>show error</button>
      <button onClick={() => showToast("It worked", "success")}>show success</button>
    </div>
  );
}

describe("ToastProvider", () => {
  it("shows a toast with the given message, defaulting to error styling", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText("show error"));

    const toast = await screen.findByText("Something failed");
    expect(toast).toHaveClass("toast-error");
  });

  it("shows a success toast when the type is success", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText("show success"));

    const toast = await screen.findByText("It worked");
    expect(toast).toHaveClass("toast-success");
  });

  it("dismisses a toast when clicked", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText("show error"));
    const toast = await screen.findByText("Something failed");

    await user.click(toast);

    await waitFor(() => expect(screen.queryByText("Something failed")).not.toBeInTheDocument());
  });

  it("auto-dismisses after a timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText("show error"));
    expect(screen.getByText("Something failed")).toBeInTheDocument();

    vi.advanceTimersByTime(5000);

    await waitFor(() => expect(screen.queryByText("Something failed")).not.toBeInTheDocument());
    vi.useRealTimers();
  });
});

describe("useToast", () => {
  it("throws when used outside a ToastProvider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow("useToast must be used within a ToastProvider");

    consoleErrorSpy.mockRestore();
  });
});
