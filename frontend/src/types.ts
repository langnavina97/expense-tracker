export type Role = "LEAD" | "ADULT" | "CHILD";

export interface User {
  id: number;
  email: string;
  name: string;
  googleId: string | null;
  householdId: number | null;
  role: Role | null;
  spenderId: number;
  deletedAt: string | null;
}

export interface Dependent {
  id: number;
  name: string;
  householdId: number;
  spenderId: number;
}

export interface Household {
  id: number;
  name: string;
  members: User[];
  dependents: Dependent[];
}

export interface Category {
  id: number;
  name: string;
  householdId: number;
}

export interface Spender {
  id: number;
}

export interface Expense {
  id: number;
  title: string;
  categoryId: number;
  currency: string;
  amount: number;
  convertedAmount: number | null;
  date: string;
  spenders: Spender[];
  createdByUserId: number;
  householdId: number;
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "MXN", "GBP", "JPY", "CAD", "CHF"] as const;
