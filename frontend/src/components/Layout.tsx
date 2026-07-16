import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api";

export function Layout() {
  const { currentUser, logout, deleteAccount } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();

  async function handleDeleteAccount() {
    const confirmed = await confirm("Delete your account? This can't be undone.");
    if (!confirmed) return;

    try {
      await deleteAccount();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete your account.");
    }
  }

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
          <button className="btn-danger btn-small" onClick={handleDeleteAccount}>
            Delete account
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
