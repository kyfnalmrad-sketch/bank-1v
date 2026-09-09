import { describe, expect, it } from "vitest";
import { buildVerificationBarcodePayload, buildVerificationQrPayload, synchronizeDocumentData } from "./documentSync";

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
    expect(payload).toContain("TYPE=ACCOUNT STATEMENT");
    expect(payload).toContain("PAGE=1/1");
    expect(payload).toContain("TX=2");
    expect(payload).toContain("DEBIT=1;25.00");
    expect(payload).toContain("CREDIT=1;100.00");
    expect(payload).toContain("REF1=FT260804ABC");
    expect(payload).toContain("OPEN=50.00");
    expect(payload).toContain("CLOSE=125.00");
    expect(payload).not.toContain("٢٢ محرم");
    const statusPayload = buildVerificationQrPayload({ reference: "BAK-ACCT-20260804-0001", accountNumber: "1001", customerName: "Client", documentType: "status", pageNumber: 1, pageCount: 1, periodStart: "04/08/2026", periodEnd: "05/08/2026", transactionCount: 2, debitCount: 1, creditCount: 1, totalDebit: 25, totalCredit: 100, openingBalance: 50, currency: "USD", closing: 125, issueDate: "05/08/2026", issueDateHijri: "٢٢ محرم ١٤٤٨ هـ" });
    expect(statusPayload).toContain("KURAIMI ISLAMIC BANK");
    expect(statusPayload).not.toContain("TRAINING");
    expect(statusPayload).toContain("TYPE=ACCOUNT STATUS");
    expect(statusPayload).toContain("HIJRI=22 Muharram 1448 AH");
    const barcode = buildVerificationBarcodePayload("BAK-ACCT-20260804-0001", 1, 3);
    expect(barcode.startsWith("KURAIMI ISLAMIC BANK|VERIFY|STMT|REF=BAK-ACCT-20260804-0001|PAGE=1/3|CHK=")).toBe(true);
    expect(barcode).not.toContain("TRAINING");
    expect(barcode.slice(-8)).toMatch(/^[0-9A-F]{8}$/);
  });

  it("uses Yemen Commercial Bank identity for YCB QR and barcode payloads", () => {
    const qr = buildVerificationQrPayload({ bankName: "YEMEN COMMERCIAL BANK", reference: "YCB-2026-001", accountNumber: "YCB-1001", transactionCount: 0, currency: "YER", closing: 0 });
    const barcode = buildVerificationBarcodePayload("YCB-2026-001", 1, 1, "YEMEN COMMERCIAL BANK");
    expect(qr.startsWith("YEMEN COMMERCIAL BANK\n")).toBe(true);
    expect(qr).not.toContain("KURAIMI ISLAMIC BANK");
    expect(barcode.startsWith("YEMEN COMMERCIAL BANK|VERIFY|STMT|REF=YCB-2026-001|PAGE=1/1|CHK=")).toBe(true);
    expect(barcode).not.toContain("KURAIMI ISLAMIC BANK");
  });
});
