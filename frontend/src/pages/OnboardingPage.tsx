import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api";

export function OnboardingPage() {
  const { currentUser, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createHousehold({ name });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1 style={{ marginBottom: 6 }}>Set up your household</h1>
      <p style={{ marginBottom: 18 }}>
        A household groups the people whose expenses you track together - you'll be its lead.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="household-name">Household name</label>
          <input
            id="household-name"
            placeholder="The Smiths"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create household"}
        </button>
      </form>

      <div className="divider-text" style={{ margin: "18px 0" }}>
        or
      </div>

      <p style={{ fontSize: "0.85rem" }}>
        Being added to someone else's household instead? You don't need to do anything here - just share your user
        ID with them: <strong>#{currentUser?.id}</strong>. You'll get access automatically once they add you.
      </p>
    </div>
  );
}
