import { describe, expect, it } from "vitest";
import { buildImportedTransactions, discoverStatementHeader, reviewDescription, statementReferenceFromTransactions } from "./statementImport";

describe("statement Excel import", () => {
  it("selects the actual Arabic heading row after preface rows without inventing columns", () => {
    const matrix = [["كشف تجريبي — معلومات إضافية", "", "", "", ""], ["مصرف الكريمي", "", "", "", ""], ["", "", "", "", ""], ["تاريخ الحركة", "وصف العملية", "مدين", "دائن", "المرجع الخارجي"], ["2026/01/05", "إيداع راتب يناير", "", "١٬٥٠٠.٥٠", "INV-100"]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.headerRowIndex).toBe(3);
    expect(discovered?.headers).toEqual(["تاريخ الحركة", "وصف العملية", "مدين", "دائن", "المرجع الخارجي"]);
    expect(discovered?.map).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, reference: 4 });
  });

  it("ignores One, Two and Three headings and rejects an ambiguous duplicate heading row", () => {
    const oneTwoThree = [["One", "Two", "Three", "Date", "Description", "Amount", "Type"], ["ignored", "ignored", "ignored", "2026-02-15", "Cash deposit", "10", "Credit"]];
    expect(discoverStatementHeader(oneTwoThree)?.headers).toEqual(["Date", "Description", "Amount", "Type"]);
    const ambiguous = [["Date", "Description", "Debit", "Credit"], ["Date", "Description", "Debit", "Credit"]];
    expect(discoverStatementHeader(ambiguous)).toBeNull();
  });

  it("reads a signed amount plus type without presenting fictional debit or credit columns", () => {
    const matrix = [["Bank Al Karimi Account Activity", "", "", "", ""], ["Posting Date", "Narration", "Amount", "Type", "Ref No"], ["2026-02-01", "Cash deposit", "1,250.50", "Credit", "EXT-A"], ["2026-02-02", "ATM withdrawal", "(500.00)", "Debit", "EXT-B"]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.map).toMatchObject({ date: 0, description: 1, amount: 2, direction: 3, reference: 4 });
    const transactions = buildImportedTransactions(matrix.slice(2), discovered!.map);
    expect(transactions.map(({ debit, credit }) => ({ debit, credit }))).toEqual([{ debit: 0, credit: 1250.5 }, { debit: 500, credit: 0 }]);
  });

  it("rejects vague transfer descriptions and keeps named or operational descriptions", () => {
    expect(reviewDescription("Family Transfers").accepted).toBe(false);
    expect(reviewDescription("Incoming transfer from Aisha Saleh")).toMatchObject({ accepted: true, suggestedDescription: "Incoming transfer from Aisha Saleh" });
    expect(reviewDescription("تحويل عائلي من أحمد محمد")).toMatchObject({ accepted: true, suggestedDescription: "Family transfer from أحمد محمد" });
    expect(reviewDescription("دفع مشتريات عبر تطبيق حاسب")).toMatchObject({ accepted: true, suggestedDescription: "Payment via Haseb" });
    expect(reviewDescription("Utility bill payment").accepted).toBe(false);
  });

  it("derives a stable statement reference from the imported date instead of the external transaction reference", () => {
    const reference = statementReferenceFromTransactions([{ date: "2026-02-15" }], "1504452");
    expect(reference).toBe("BAK-ACCT-20260215-4452");
  });
});
