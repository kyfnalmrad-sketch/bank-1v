import { describe, expect, it } from "vitest";
import { buildVerificationQrPayload, synchronizeDocumentData } from "./documentSync";

describe("applied transaction register synchronization", () => {
  it("uses the applied register as the only source for totals, balances and QR payload", () => {
    const source = [
      { rowNumber: 1, date: "2026-08-04", description: "Cash deposit", debit: 0, credit: 100, balance: 150, externalReference: "", operationNumber: "FT260804ABC", rejected: false },
      { rowNumber: 2, date: "2026-08-05", description: "ATM withdrawal", debit: 25, credit: 0, balance: null, externalReference: "", operationNumber: "FT260805DEF", rejected: false },
      { rowNumber: 3, date: "2026-08-06", description: "Utility bill payment", debit: 12, credit: 0, balance: null, externalReference: "", operationNumber: "FT260806GHI", rejected: true },
    ];
    const synced = synchronizeDocumentData(source, 50);
    expect(synced.totalCredit).toBe(100);
    expect(synced.totalDebit).toBe(25);
    expect(synced.statementRows.map((row) => row.balance)).toEqual([150, 125]);
    expect(synced.closing).toBe(125);
    const payload = buildVerificationQrPayload({ reference: "BAK-ACCT-20260804-0001", accountNumber: "1001", customerName: "Client", documentType: "statement", pageNumber: 1, pageCount: 1, periodStart: "04/08/2026", periodEnd: "05/08/2026", firstReference: "FT260804ABC", lastReference: "FT260805DEF", transactionCount: synced.acceptedRows.length, debitCount: 1, creditCount: 1, totalDebit: synced.totalDebit, totalCredit: synced.totalCredit, openingBalance: 50, currency: "USD", closing: synced.closing, issueDate: "05/08/2026", issueDateHijri: "٢٢ محرم ١٤٤٨ هـ" });
    expect(payload).toContain("الصفحة: ١/١");
    expect(payload).toContain("العمليات: ٢ | سحب: ١ (25.00) | إيداع: ١ (100.00)");
    expect(payload).toContain("أول مرجع: FT260804ABC");
    expect(payload).toContain("رصيد البداية: 50.00 | رصيد النهاية: 125.00");
  });
});
