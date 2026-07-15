import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { currentUser, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">💸 Expense Tracker</div>
        {currentUser?.householdId && (
          <nav className="topbar-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/categories">Categories</NavLink>
            <NavLink to="/household">Household</NavLink>
          </nav>
        )}
        <div className="topbar-user">
          {currentUser && <span>{currentUser.name}</span>}
          <button className="btn-ghost btn-small" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
