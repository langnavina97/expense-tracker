import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api";
import type { Household, Role } from "../types";

const ROLES: Role[] = ["LEAD", "ADULT", "CHILD"];

export function HouseholdPage() {
  const { currentUser } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("ADULT");
  const [addingMember, setAddingMember] = useState(false);

  const [dependentName, setDependentName] = useState("");
  const [addingDependent, setAddingDependent] = useState(false);

  async function loadHousehold() {
    try {
      setHousehold(await api.getHousehold());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your household.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHousehold();
  }, []);

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAddingMember(true);
    try {
      await api.addMember({ userId: Number(memberUserId), role: memberRole });
      setMemberUserId("");
      await loadHousehold();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that member.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleAddDependent(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAddingDependent(true);
    try {
      await api.addDependent({ name: dependentName });
      setDependentName("");
      await loadHousehold();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that dependent.");
    } finally {
      setAddingDependent(false);
    }
  }

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!household || !currentUser) return null;

  const canAddMembers = currentUser.role === "LEAD";
  const canAddDependents = currentUser.role === "LEAD" || currentUser.role === "ADULT";

  return (
    <div>
      <div className="page-header">
        <h1>{household.name}</h1>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Members</h2>
        <div className="simple-list">
          {household.members.map((member) => (
            <div className="simple-list-row" key={member.id}>
              <div>
                <div>
                  {member.name} <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>(ID: {member.id})</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{member.email}</div>
              </div>
              <span className="badge">{member.role}</span>
            </div>
          ))}
        </div>

        {canAddMembers && (
          <>
            <p style={{ marginTop: 16, fontSize: "0.85rem" }}>
              To add someone, have them register their own account first (without creating a household) - their
              user ID is shown next to their name in the top bar once they're logged in.
            </p>
            <form onSubmit={handleAddMember} className="form-row">
              <input
                type="number"
                placeholder="Existing user ID"
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button className="btn-primary" type="submit" disabled={addingMember}>
                Add
              </button>
            </form>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Dependents</h2>
        {household.dependents.length === 0 ? (
          <p>No dependents yet - add household members who don't have their own login, like young kids.</p>
        ) : (
          <div className="simple-list">
            {household.dependents.map((dependent) => (
              <div className="simple-list-row" key={dependent.id}>
                <span>{dependent.name}</span>
              </div>
            ))}
          </div>
        )}

        {canAddDependents && (
          <form onSubmit={handleAddDependent} className="form-row" style={{ marginTop: 16 }}>
            <input
              placeholder="Dependent's name"
              value={dependentName}
              onChange={(e) => setDependentName(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button className="btn-primary" type="submit" disabled={addingDependent}>
              Add
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
