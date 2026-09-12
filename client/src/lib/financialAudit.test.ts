import { describe, expect, it } from "vitest";
import { auditFinancialStatement } from "./financialAudit";

describe("financial audit engine", () => {
  it("reconciles running balances and totals", () => {
    const result = auditFinancialStatement({ openingBalance: 0, rows: [
      { rowNumber: 1, date: "2026-08-01", operationNumber: "A1", description: "Deposit", debit: 0, credit: 100, balance: 100 },
      { rowNumber: 2, date: "2026-08-02", operationNumber: "A2", description: "Withdrawal", debit: 40, credit: 0, balance: 60 },
    ], printedCredit: 100, printedDebit: 40, printedClosing: 60 });
    expect(result.isMatch).toBe(true);
    expect(result.calculatedClosing).toBe(60);
  });

  it("reports a critical final balance mismatch without inventing a transaction", () => {
    const result = auditFinancialStatement({ openingBalance: 0, rows: [{ rowNumber: 1, date: "2026-08-01", operationNumber: "A1", description: "Deposit", debit: 0, credit: 100, balance: 100 }], printedClosing: 140 });
    expect(result.isMatch).toBe(false);
    expect(result.issues.some((issue) => issue.type === "closing-balance" && issue.severity === "critical")).toBe(true);
    expect(result.calculatedClosing).toBe(100);
  });

  it("flags a row with both debit and credit and possible duplicates", () => {
    const rows = [{ rowNumber: 1, date: "2026-08-01", operationNumber: "A1", description: "Same", debit: 10, credit: 10, balance: 0 }, { rowNumber: 2, date: "2026-08-01", operationNumber: "A1", description: "Same", debit: 10, credit: 10, balance: 0 }];
    const result = auditFinancialStatement({ openingBalance: 0, rows });
    expect(result.issues.some((issue) => issue.type === "transaction")).toBe(true);
    expect(result.issues.some((issue) => issue.type === "duplicate")).toBe(true);
  });
});
