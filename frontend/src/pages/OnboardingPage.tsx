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
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h1 style={{ marginBottom: 6, fontSize: "1.15rem" }}>Waiting to be added to a household?</h1>
        <p style={{ marginBottom: 14 }}>
          If someone else already has a household set up, you don't need to do anything on this page. Send them your
          user ID - they can add you from their own Household page.
        </p>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <span className="badge" style={{ fontSize: "1.15rem", padding: "8px 20px" }}>
            #{currentUser?.id}
          </span>
        </div>
        <p style={{ fontSize: "0.82rem", textAlign: "center", marginTop: 8 }}>
          You'll get access automatically the moment they add you - no need to refresh, just check back here.
        </p>
      </div>

      <div className="card">
        <h1 style={{ marginBottom: 6, fontSize: "1.15rem" }}>Or, start a new household</h1>
        <p style={{ marginBottom: 18 }}>
          Only do this if you're the <strong>first</strong> person setting things up for your household - you'll
          become its lead, and can add everyone else afterward using their IDs.
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
      </div>
    </div>
  );
}
