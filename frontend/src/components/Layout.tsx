import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { currentUser, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span aria-hidden="true">💸</span>
          <span className="topbar-brand-text">Expense Tracker</span>
        </div>
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
          {currentUser && (
            <span>
              {currentUser.name} <span className="user-id-tag">#{currentUser.id}</span>
            </span>
          )}
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
