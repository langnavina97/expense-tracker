import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      deleteAccount: vi.fn(),
    },
  };
});

function TestConsumer() {
  const { currentUser, loading, login, register, logout, deleteAccount } = useAuth();

  if (loading) return <div>loading</div>;

  return (
    <div>
      <div data-testid="user">{currentUser ? currentUser.name : "none"}</div>
      <button onClick={() => login("a@b.com", "password")}>login</button>
      <button onClick={() => register("Alice", "a@b.com", "password")}>register</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => deleteAccount()}>delete</button>
    </div>
  );
}

const testUser = { id: 1, name: "Alice", email: "a@b.com", googleId: null, householdId: null, role: null, spenderId: 1, deletedAt: null };

beforeEach(() => {
  vi.mocked(api.me).mockReset();
  vi.mocked(api.login).mockReset();
  vi.mocked(api.register).mockReset();
  vi.mocked(api.logout).mockReset();
  vi.mocked(api.deleteAccount).mockReset();
});

describe("AuthProvider", () => {
  it("sets currentUser after a successful bootstrap check", async () => {
    vi.mocked(api.me).mockResolvedValueOnce(testUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Alice"));
  });

  it("leaves currentUser null when the bootstrap check gets a 401", async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new ApiError(401, "Authentication required."));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });

  it("login sets currentUser from the response", async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new ApiError(401, "Authentication required."));
    vi.mocked(api.login).mockResolvedValueOnce(testUser);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));

    await user.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Alice"));
    expect(api.login).toHaveBeenCalledWith({ email: "a@b.com", password: "password" });
  });

  it("register calls register then login, and sets currentUser", async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new ApiError(401, "Authentication required."));
    vi.mocked(api.register).mockResolvedValueOnce(undefined as any);
    vi.mocked(api.login).mockResolvedValueOnce(testUser);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));

    await user.click(screen.getByText("register"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Alice"));
    expect(api.register).toHaveBeenCalledWith({ name: "Alice", email: "a@b.com", password: "password" });
    expect(api.login).toHaveBeenCalledWith({ email: "a@b.com", password: "password" });
  });

  it("logout clears currentUser", async () => {
    vi.mocked(api.me).mockResolvedValueOnce(testUser);
    vi.mocked(api.logout).mockResolvedValueOnce(undefined as any);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Alice"));

    await user.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });

  it("deleteAccount calls the API with the current user's id and clears currentUser", async () => {
    vi.mocked(api.me).mockResolvedValueOnce(testUser);
    vi.mocked(api.deleteAccount).mockResolvedValueOnce(undefined as any);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Alice"));

    await user.click(screen.getByText("delete"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(api.deleteAccount).toHaveBeenCalledWith(1);
  });

  it("deleteAccount does nothing if there's no current user", async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new ApiError(401, "Authentication required."));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));

    await user.click(screen.getByText("delete"));

    expect(api.deleteAccount).not.toHaveBeenCalled();
  });
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within an AuthProvider");

    consoleErrorSpy.mockRestore();
  });
});
