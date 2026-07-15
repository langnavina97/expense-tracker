import type { Category, Expense, Household, User } from "./types";

interface ExpenseInput {
  title: string;
  categoryId: number;
  spenderIds: number[];
  currency: string;
  amount: number;
  date: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "Something went wrong.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<User>("/users/me"),
  register: (data: { name: string; email: string; password: string }) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<User>("/users/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ message: string }>("/users/logout", { method: "POST" }),
  deleteAccount: (id: number) => request<{ message: string }>(`/users/${id}`, { method: "DELETE" }),

  getHousehold: () => request<Household>("/households"),
  createHousehold: (data: { name: string }) =>
    request<Household>("/households", { method: "POST", body: JSON.stringify(data) }),
  addMember: (data: { userId: number; role: string }) =>
    request<User>("/households/members", { method: "POST", body: JSON.stringify(data) }),
  addDependent: (data: { name: string }) =>
    request<{ id: number; name: string }>("/households/dependents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCategories: () => request<Category[]>("/categories"),
  createCategory: (data: { name: string }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
  renameCategory: (id: number, data: { name: string }) =>
    request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request<{ message: string }>(`/categories/${id}`, { method: "DELETE" }),

  getExpenses: () => request<Expense[]>("/expenses"),
  suggestCategory: (title: string) =>
    request<{ suggestedCategory: Category | null; unavailable?: boolean }>("/expenses/suggest-category", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  createExpense: (data: ExpenseInput) => request<Expense>("/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: number, data: Partial<ExpenseInput>) =>
    request<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExpense: (id: number) => request<{ message: string }>(`/expenses/${id}`, { method: "DELETE" }),
};
