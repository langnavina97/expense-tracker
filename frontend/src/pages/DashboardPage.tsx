import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api";
import { ExpenseForm } from "../components/ExpenseForm";
import { CHART_COLORS, PieChart } from "../components/PieChart";
import type { Category, Expense, Household } from "../types";
import { formatMoney, spenderName } from "../utils";

function canModify(currentUser: { id: number; role: string | null }, expense: Expense): boolean {
  return currentUser.role !== "CHILD" || expense.createdByUserId === currentUser.id;
}

const ALL_CATEGORIES = "ALL";

export function DashboardPage() {
  const { currentUser } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<number | typeof ALL_CATEGORIES>(ALL_CATEGORIES);

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

  async function handleDelete(id: number) {
    if (!confirm("Delete this expense?")) return;
    try {
      await api.deleteExpense(id);
      setExpenses((current) => current.filter((e) => e.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't delete this expense.");
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

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!household || !currentUser) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // Same index-based assignment the pie chart uses, so a category's badge
  // color always matches its slice.
  const categoryColor = new Map(categories.map((c, i) => [c.id, CHART_COLORS[i % CHART_COLORS.length]!]));

  // Category breakdown always reflects every expense, regardless of the
  // filter below - it's the "big picture" the filter lets you drill into.
  const totalsByCategory = new Map<number, number>();
  for (const expense of expenses) {
    totalsByCategory.set(
      expense.categoryId,
      (totalsByCategory.get(expense.categoryId) ?? 0) + (expense.convertedAmount ?? 0)
    );
  }
  const pieSlices = categories
    .map((category, index) => ({
      label: category.name,
      value: totalsByCategory.get(category.id) ?? 0,
      color: CHART_COLORS[index % CHART_COLORS.length]!,
    }))
    .filter((slice) => slice.value > 0);

  const filteredExpenses =
    categoryFilter === ALL_CATEGORIES ? expenses : expenses.filter((e) => e.categoryId === categoryFilter);
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
          <div className="stat-label">Total{categoryFilter !== ALL_CATEGORIES ? " (filtered)" : ""}</div>
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

      {pieSlices.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: 16 }}>Spending by category</h2>
          <PieChart slices={pieSlices} />
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
              className={`checkbox-pill ${categoryFilter === ALL_CATEGORIES ? "checked" : ""}`}
              onClick={() => setCategoryFilter(ALL_CATEGORIES)}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`checkbox-pill ${categoryFilter === category.id ? "checked" : ""}`}
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {sortedExpenses.length === 0 ? (
            <div className="card empty-state">
              <p>No expenses in this category.</p>
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
                              backgroundColor: `${categoryColor.get(category.id)}22`,
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
                          <button className="btn-danger btn-small" onClick={() => handleDelete(expense.id)}>
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
