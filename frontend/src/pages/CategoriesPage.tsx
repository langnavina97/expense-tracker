import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Category } from "../types";

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  async function loadCategories() {
    try {
      setCategories(await api.getCategories());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const category = await api.createCategory({ name: newName });
      setCategories((current) => [...current, category]);
      setNewName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create category.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditingName(category.name);
  }

  async function saveEdit(id: number) {
    try {
      const updated = await api.renameCategory(id, { name: editingName });
      setCategories((current) => current.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename category.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category? Expenses using it will need a new category.")) return;
    try {
      await api.deleteCategory(id);
      setCategories((current) => current.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't delete this category.");
    }
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Categories</h1>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <form onSubmit={handleAdd} className="form-row">
          <input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button className="btn-primary" type="submit" disabled={adding}>
            Add
          </button>
        </form>
      </div>

      <div className="card">
        {categories.length === 0 ? (
          <div className="empty-state">No categories yet.</div>
        ) : (
          <div className="simple-list">
            {categories.map((category) => (
              <div className="simple-list-row" key={category.id}>
                {editingId === category.id ? (
                  <>
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary btn-small" onClick={() => saveEdit(category.id)}>
                        Save
                      </button>
                      <button className="btn-ghost btn-small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{category.name}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost btn-small" onClick={() => startEdit(category)}>
                        Rename
                      </button>
                      <button className="btn-danger btn-small" onClick={() => handleDelete(category.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
