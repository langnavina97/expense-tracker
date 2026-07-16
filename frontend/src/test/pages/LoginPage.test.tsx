import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../../pages/LoginPage";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const loginMock = vi.fn();

beforeEach(() => {
  loginMock.mockReset();
  vi.mocked(useAuth).mockReturnValue({
    currentUser: null,
    loading: false,
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    refresh: vi.fn(),
  });
});

function renderLoginPage(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("submits email and password to login()", async () => {
    loginMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("a@b.com", "correcthorsebatterystaple"));
  });

  it("shows the server's error message when login fails", async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, "Invalid email or password."));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("shows a generic message for a non-ApiError failure", async () => {
    loginMock.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("shows a human-readable message for a Google OAuth error in the URL", () => {
    renderLoginPage("/login?error=oauth_state");

    expect(screen.getByText("Your Google sign-in session expired. Please try again.")).toBeInTheDocument();
  });

  it("falls back to a generic message for an unrecognized OAuth error code", () => {
    renderLoginPage("/login?error=something_weird");

    expect(screen.getByText("Sign-in failed.")).toBeInTheDocument();
  });

  it("links to Google OAuth via a real anchor tag, not a button", () => {
    renderLoginPage();

    const googleLink = screen.getByText("Continue with Google").closest("a");
    expect(googleLink).toHaveAttribute("href", "/auth/google");
  });
});
