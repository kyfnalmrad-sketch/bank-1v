import { describe, expect, it } from "vitest";
import { auditFinancialStatement } from "./financialAudit";

describe("financial audit engine", () => {
  it.each(["tadhamon", "ycb", "karimi"])("reconciles the %s bank path with valid values", (bank) => {
    const result = auditFinancialStatement({ openingBalance: 1000, rows: [{ rowNumber: 1, date: "2026-08-01", operationNumber: `${bank}-1`, description: "Deposit", debit: 0, credit: 250, balance: 1250 }, { rowNumber: 2, date: "2026-08-02", operationNumber: `${bank}-2`, description: "Withdrawal", debit: 50, credit: 0, balance: 1200 }], printedCredit: 250, printedDebit: 50, printedClosing: 1200 });
    expect(result.isMatch).toBe(true);
  });

  it.each(["tadhamon", "ycb", "karimi"])("rejects the %s bank path with an incorrect final value", (bank) => {
    const result = auditFinancialStatement({ openingBalance: 1000, rows: [{ rowNumber: 1, date: "2026-08-01", operationNumber: `${bank}-1`, description: "Deposit", debit: 0, credit: 250, balance: 1250 }], printedClosing: 1300 });
    expect(result.isMatch).toBe(false);
    expect(result.issues.find((issue) => issue.type === "closing-balance")?.severity).toBe("critical");
  });

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

  it("detects the reported 13,700 credit, 7,200 debit, and 7,140 closing mismatch", () => {
    const result = auditFinancialStatement({ openingBalance: 0, rows: [{ rowNumber: 1, date: "2026-08-29", operationNumber: "DEP-1", description: "Deposits", debit: 0, credit: 13700, balance: 6650 }, { rowNumber: 2, date: "2026-08-31", operationNumber: "ATM-1", description: "ATM withdrawal", debit: 7200, credit: 0, balance: 6500 }], printedCredit: 13700, printedDebit: 7200, printedClosing: 7140 });
    expect(result.calculatedClosing).toBe(6500);
    expect(result.issues.find((issue) => issue.type === "closing-balance")?.difference).toBe(640);
    expect(result.isMatch).toBe(false);
  });

  it("flags a row with both debit and credit and possible duplicates", () => {
    const rows = [{ rowNumber: 1, date: "2026-08-01", operationNumber: "A1", description: "Same", debit: 10, credit: 10, balance: 0 }, { rowNumber: 2, date: "2026-08-01", operationNumber: "A1", description: "Same", debit: 10, credit: 10, balance: 0 }];
    const result = auditFinancialStatement({ openingBalance: 0, rows });
    expect(result.issues.some((issue) => issue.type === "transaction")).toBe(true);
    expect(result.issues.some((issue) => issue.type === "duplicate")).toBe(true);
  });

  it("warns when the print date is later than the statement period", () => {
    const result = auditFinancialStatement({ openingBalance: 0, rows: [], periodEnd: "2026-08-31", printDate: "2026-09-12" });
    expect(result.issues.some((issue) => issue.type === "date-or-currency")).toBe(true);
  });
});
