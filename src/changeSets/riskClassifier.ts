import type { RiskLevel } from "./changeSetTypes.js";

// Placeholder keyword classifier from MVP 1 spec section 14; replace with a
// real classifier once change sets carry enough traffic to learn from.
const HIGH_RISK_TERMS = [
  "infrastructure",
  "auth",
  "security",
  "migration",
  "database",
  "dependency",
  "delete",
  "secret",
  "credential",
  "billing",
  "gcp",
  "production",
];

export function classifyRisk(goal: string): RiskLevel {
  const normalized = goal.toLowerCase();

  if (HIGH_RISK_TERMS.some((term) => normalized.includes(term))) {
    return "high";
  }

  return "medium";
}
