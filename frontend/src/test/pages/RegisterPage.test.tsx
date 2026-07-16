import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RegisterPage } from "../../pages/RegisterPage";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const registerMock = vi.fn();

beforeEach(() => {
  registerMock.mockReset();
  vi.mocked(useAuth).mockReturnValue({
    currentUser: null,
    loading: false,
    login: vi.fn(),
    register: registerMock,
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    refresh: vi.fn(),
  });
});

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe("RegisterPage", () => {
  it("submits name, email, and password to register()", async () => {
    registerMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Name"), "Alice");
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith("Alice", "a@b.com", "correcthorsebatterystaple")
    );
  });

  it("shows the server's error message when registration fails", async () => {
    registerMock.mockRejectedValueOnce(new ApiError(409, 'User "a@b.com" already exists.'));
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Name"), "Alice");
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText('User "a@b.com" already exists.')).toBeInTheDocument();
  });

  it("links to Google OAuth via a real anchor tag", () => {
    renderRegisterPage();

    const googleLink = screen.getByText("Continue with Google").closest("a");
    expect(googleLink).toHaveAttribute("href", "/auth/google");
  });
});
