import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../api";
import { useAuth } from "../context/AuthContext";
import { SUPPORTED_CURRENCIES, type Category, type Expense, type Household } from "../types";

interface ExpenseFormProps {
  household: Household;
  categories: Category[];
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({ household, categories, expense, onClose, onSaved }: ExpenseFormProps) {
  const { currentUser } = useAuth();
  const isEditing = Boolean(expense);

  const [title, setTitle] = useState(expense?.title ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(expense?.categoryId ?? "");
  const [currency, setCurrency] = useState(expense?.currency ?? "USD");
  const [amount, setAmount] = useState(expense ? (expense.amount / 100).toFixed(2) : "");
  const [date, setDate] = useState(expense?.date.slice(0, 10) ?? todayISODate());
  const [spenderIds, setSpenderIds] = useState<number[]>(
    expense?.spenders.map((s) => s.id) ?? (currentUser ? [currentUser.spenderId] : [])
  );

  const [suggesting, setSuggesting] = useState(false);
  const [suggestionHint, setSuggestionHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const people = [
    ...household.members.map((m) => ({ spenderId: m.spenderId, name: m.name })),
    ...household.dependents.map((d) => ({ spenderId: d.spenderId, name: d.name })),
  ];

  function toggleSpender(spenderId: number) {
    setSpenderIds((current) =>
      current.includes(spenderId) ? current.filter((id) => id !== spenderId) : [...current, spenderId]
    );
  }

  async function handleSuggest() {
    if (!title.trim()) return;
    setSuggesting(true);
    setSuggestionHint(null);
    try {
      const { suggestedCategory, unavailable } = await api.suggestCategory(title);
      if (suggestedCategory) {
        setCategoryId(suggestedCategory.id);
        setSuggestionHint(`AI picked "${suggestedCategory.name}" for this title.`);
      } else if (unavailable) {
        setSuggestionHint("AI suggestions are unavailable right now - pick a category manually.");
      } else {
        setSuggestionHint("No strong match - pick a category manually.");
      }
    } catch {
      setSuggestionHint("Couldn't get a suggestion right now.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (spenderIds.length === 0) {
      setError("Select at least one person this expense is for.");
      return;
    }
    if (categoryId === "") {
      setError("Choose a category.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        categoryId: Number(categoryId),
        spenderIds,
        currency,
        amount: Math.round(Number(amount) * 100),
        date,
      };
      if (expense) {
        await api.updateExpense(expense.id, payload);
      } else {
        await api.createExpense(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit expense" : "Add expense"} onClose={onClose}>
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            placeholder="Taco Tuesday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="" disabled>
              Select a category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary btn-small"
            style={{ alignSelf: "flex-start" }}
            onClick={handleSuggest}
            disabled={suggesting || !title.trim()}
          >
            {suggesting ? "Thinking…" : "✨ Suggest with AI"}
          </button>
          {suggestionHint && <span className="suggestion-hint">{suggestionHint}</span>}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Who's this for?</label>
          <div className="checkbox-group">
            {people.map((person) => (
              <label
                key={person.spenderId}
                className={`checkbox-pill ${spenderIds.includes(person.spenderId) ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={spenderIds.includes(person.spenderId)}
                  onChange={() => toggleSpender(person.spenderId)}
                />
                {person.name}
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
        </button>
      </form>
    </Modal>
  );
}
