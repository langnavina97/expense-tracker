import type { Household } from "./types";

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function spenderName(spenderId: number, household: Household): string {
  const member = household.members.find((m) => m.spenderId === spenderId);
  if (member) return member.name;
  const dependent = household.dependents.find((d) => d.spenderId === spenderId);
  return dependent?.name ?? "Unknown";
}
