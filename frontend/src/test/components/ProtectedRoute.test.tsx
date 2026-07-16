import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute, RequireHousehold, RedirectIfAuthenticated } from "../../components/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockAuth(overrides: Partial<{ currentUser: User | null; loading: boolean }>) {
  vi.mocked(useAuth).mockReturnValue({
    currentUser: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
}

const someUser: User = {
  id: 1,
  email: "a@b.com",
  name: "Alice",
  googleId: null,
  householdId: null,
  role: null,
  spenderId: 1,
  deletedAt: null,
};

beforeEach(() => {
  vi.mocked(useAuth).mockReset();
});

describe("ProtectedRoute", () => {
  function renderWithRoute(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it("shows a loading screen while auth is still resolving", () => {
    mockAuth({ loading: true });
    renderWithRoute("/dashboard");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to /login when there's no current user", () => {
    mockAuth({ currentUser: null, loading: false });
    renderWithRoute("/dashboard");

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the nested route when authenticated", () => {
    mockAuth({ currentUser: someUser, loading: false });
    renderWithRoute("/dashboard");

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});

describe("RequireHousehold", () => {
  function renderWithRoute(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/onboarding" element={<div>onboarding page</div>} />
          <Route element={<RequireHousehold />}>
            <Route path="/dashboard" element={<div>dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it("redirects to /onboarding when the user has no household", () => {
    mockAuth({ currentUser: { ...someUser, householdId: null } });
    renderWithRoute("/dashboard");

    expect(screen.getByText("onboarding page")).toBeInTheDocument();
  });

  it("renders the nested route when the user has a household", () => {
    mockAuth({ currentUser: { ...someUser, householdId: 1 } });
    renderWithRoute("/dashboard");

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});

describe("RedirectIfAuthenticated", () => {
  function renderWithRoute(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<div>home page</div>} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <div>login page</div>
              </RedirectIfAuthenticated>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it("shows a loading screen while auth is still resolving", () => {
    mockAuth({ loading: true });
    renderWithRoute("/login");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to / when already authenticated", () => {
    mockAuth({ currentUser: someUser, loading: false });
    renderWithRoute("/login");

    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("renders its children when not authenticated", () => {
    mockAuth({ currentUser: null, loading: false });
    renderWithRoute("/login");

    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});
