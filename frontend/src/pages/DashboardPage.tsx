import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError } from "../api";
import { ExpenseForm } from "../components/ExpenseForm";
import { LoadingScreen } from "../components/LoadingScreen";
import { CHART_COLORS, CHART_OTHER_COLOR, MAX_CHART_SLICES, PieChart, type PieSlice } from "../components/PieChart";
import type { Category, Expense, Household } from "../types";
import { formatMoney, spenderName } from "../utils";

function canModify(currentUser: { id: number; role: string | null }, expense: Expense): boolean {
  return currentUser.role !== "CHILD" || expense.createdByUserId === currentUser.id;
}

// Assigns chart colors in the fixed, CVD-validated order (see PieChart.tsx),
// sorted by value so the biggest slices get the most distinct hues. Beyond
// MAX_CHART_SLICES entries, the smallest ones fold into one "Other" slice
// rather than cycling back through the same colors. Returns both the pie
// slices and an id->color map, so an expense's category badge always
// matches its slice in the chart above it.
function buildBreakdown(entries: { id: number; label: string; value: number }[]) {
  const withValues = entries.filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const overflow = withValues.length > MAX_CHART_SLICES;
  const visibleCount = overflow ? MAX_CHART_SLICES - 1 : withValues.length;

  const colorById = new Map<number, string>();
  const slices: PieSlice[] = [];

  withValues.slice(0, visibleCount).forEach((entry, i) => {
    const color = CHART_COLORS[i]!;
    colorById.set(entry.id, color);
    slices.push({ label: entry.label, value: entry.value, color });
  });

  if (overflow) {
    const rest = withValues.slice(visibleCount);
    rest.forEach((entry) => colorById.set(entry.id, CHART_OTHER_COLOR));
    slices.push({
      label: "Other",
      value: rest.reduce((sum, entry) => sum + entry.value, 0),
      color: CHART_OTHER_COLOR,
    });
  }

  return { slices, colorById };
}

export function DashboardPage() {
  const { currentUser } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [household, setHousehold] = useState<Household | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  // Empty set means "no filter" - every category shown.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());

  async function loadAll() {
    try {
      const [householdData, categoriesData, expensesData] = await Promise.all([
        api.getHousehold(),
        api.getCategories(),
        api.getExpenses(),
      ]);
      setHousehold(householdData);
      setCategories(categoriesData);
      setExpenses(expensesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your expenses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: number, title: string) {
    const confirmed = await confirm(`Delete "${title}"?`);
    if (!confirmed) return;

    try {
      await api.deleteExpense(id);
      setExpenses((current) => current.filter((e) => e.id !== id));
      showToast(`"${title}" was deleted.`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete this expense.");
    }
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  function openAdd() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function handleSaved() {
    setFormOpen(false);
    setEditingExpense(undefined);
    loadAll();
  }

  function toggleCategoryFilter(categoryId: number) {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!household || !currentUser) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Both breakdowns always reflect every expense, regardless of the filter
  // below - they're the "big picture" the filter lets you drill into.
  const totalsByCategory = new Map<number, number>();
  // An expense can have multiple spenders (a shared purchase) - split its
  // amount evenly across them for the per-person breakdown.
  const totalsBySpender = new Map<number, number>();
  for (const expense of expenses) {
    totalsByCategory.set(
      expense.categoryId,
      (totalsByCategory.get(expense.categoryId) ?? 0) + (expense.convertedAmount ?? 0)
    );
    const perPerson = (expense.convertedAmount ?? 0) / expense.spenders.length;
    for (const spender of expense.spenders) {
      totalsBySpender.set(spender.id, (totalsBySpender.get(spender.id) ?? 0) + perPerson);
    }
  }

  const { slices: categorySlices, colorById: categoryColor } = buildBreakdown(
    categories.map((c) => ({ id: c.id, label: c.name, value: totalsByCategory.get(c.id) ?? 0 }))
  );

  const people = [
    ...household.members.map((m) => ({ spenderId: m.spenderId, name: m.name })),
    ...household.dependents.map((d) => ({ spenderId: d.spenderId, name: d.name })),
  ];
  const { slices: peopleSlices } = buildBreakdown(
    people.map((p) => ({ id: p.spenderId, label: p.name, value: totalsBySpender.get(p.spenderId) ?? 0 }))
  );

  const filteredExpenses =
    selectedCategoryIds.size === 0 ? expenses : expenses.filter((e) => selectedCategoryIds.has(e.categoryId));
  const sortedExpenses = [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date();
  const totalCents = filteredExpenses.reduce((sum, e) => sum + (e.convertedAmount ?? 0), 0);
  const thisMonthCents = filteredExpenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, e) => sum + (e.convertedAmount ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Expenses</h1>
        {categories.length > 0 && (
          <button className="btn-primary" onClick={openAdd}>
            + Add expense
          </button>
        )}
      </div>

      <div className="summary-row">
        <div className="stat-card">
          <div className="stat-label">Total{selectedCategoryIds.size > 0 ? " (filtered)" : ""}</div>
          <div className="stat-value">{formatMoney(totalCents, "USD")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This month</div>
          <div className="stat-value">{formatMoney(thisMonthCents, "USD")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses</div>
          <div className="stat-value">{filteredExpenses.length}</div>
        </div>
      </div>

      {(categorySlices.length > 0 || peopleSlices.length > 0) && (
        <div className="charts-row">
          {categorySlices.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: "1rem", marginBottom: 16 }}>Spending by category</h2>
              <PieChart slices={categorySlices} />
            </div>
          )}

          {peopleSlices.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: "1rem", marginBottom: 16 }}>Spending by person</h2>
              <PieChart slices={peopleSlices} />
            </div>
          )}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="card empty-state">
          <p>
            You need at least one category before adding expenses. Head to{" "}
            <Link to="/categories">Categories</Link> to create one.
          </p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="card empty-state">
          <p>No expenses yet. Add your first one to get started.</p>
        </div>
      ) : (
        <>
          <div className="filter-pills">
            <button
              type="button"
              className={`checkbox-pill ${selectedCategoryIds.size === 0 ? "checked" : ""}`}
              onClick={() => setSelectedCategoryIds(new Set())}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`checkbox-pill ${selectedCategoryIds.has(category.id) ? "checked" : ""}`}
                onClick={() => toggleCategoryFilter(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {sortedExpenses.length === 0 ? (
            <div className="card empty-state">
              <p>No expenses in these categories.</p>
            </div>
          ) : (
            <div className="expense-list">
              <div className="expense-list-header">
                <span>Title</span>
                <span className="expense-amounts">Amount</span>
                <span className="expense-actions"></span>
              </div>
              {sortedExpenses.map((expense) => {
                const category = categoryById.get(expense.categoryId);
                const modifiable = canModify(currentUser, expense);
                return (
                  <div className="expense-row" key={expense.id}>
                    <div className="expense-row-main">
                      <div className="expense-title">{expense.title}</div>
                      <div className="expense-meta">
                        {category && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${categoryColor.get(category.id)} 18%, transparent)`,
                              color: categoryColor.get(category.id),
                            }}
                          >
                            {category.name}
                          </span>
                        )}
                        <span>{expense.date.slice(0, 10)}</span>
                        <span>{expense.spenders.map((s) => spenderName(s.id, household)).join(", ")}</span>
                      </div>
                    </div>
                    <div className="expense-amounts">
                      <div className="expense-amount">{formatMoney(expense.amount, expense.currency)}</div>
                      {expense.currency !== "USD" && expense.convertedAmount != null && (
                        <div className="expense-amount-converted">
                          ≈ {formatMoney(expense.convertedAmount, "USD")}
                        </div>
                      )}
                    </div>
                    <div className="expense-actions">
                      {modifiable && (
                        <>
                          <button className="btn-ghost btn-small" onClick={() => openEdit(expense)}>
                            Edit
                          </button>
                          <button
                            className="btn-danger btn-small"
                            onClick={() => handleDelete(expense.id, expense.title)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {formOpen && (
        <ExpenseForm
          household={household}
          categories={categories}
          expense={editingExpense}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
