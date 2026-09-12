import { describe, expect, it } from "vitest";
import {
  buildVerificationBarcodePayload,
  buildVerificationQrPayload,
  buildYcbStatementBarcodePayload,
  buildYcbStatementQrPayload,
  synchronizeDocumentData,
} from "./documentSync";

describe("applied transaction register synchronization", () => {
  it("uses the applied register as the only source for totals, balances and QR payload", () => {
    const source = [
      {
        rowNumber: 1,
        date: "2026-08-04",
        description: "Cash deposit",
        debit: 0,
        credit: 100,
        balance: 150,
        externalReference: "",
        operationNumber: "FT260804ABC",
        rejected: false,
      },
      {
        rowNumber: 2,
        date: "2026-08-05",
        description: "ATM withdrawal",
        debit: 25,
        credit: 0,
        balance: null,
        externalReference: "",
        operationNumber: "FT260805DEF",
        rejected: false,
      },
      {
        rowNumber: 3,
        date: "2026-08-06",
        description: "Utility bill payment",
        debit: 12,
        credit: 0,
        balance: null,
        externalReference: "",
        operationNumber: "FT260806GHI",
        rejected: true,
      },
    ];
    const synced = synchronizeDocumentData(source, 50);
    expect(synced.totalCredit).toBe(100);
    expect(synced.totalDebit).toBe(25);
    expect(synced.statementRows.map(row => row.balance)).toEqual([150, 125]);
    expect(synced.closing).toBe(125);
    const payload = buildVerificationQrPayload({
      reference: "BAK-ACCT-20260804-0001",
      accountNumber: "1001",
      customerName: "Client",
      documentType: "statement",
      pageNumber: 1,
      pageCount: 1,
      periodStart: "04/08/2026",
      periodEnd: "05/08/2026",
      firstReference: "FT260804ABC",
      lastReference: "FT260805DEF",
      transactionCount: synced.acceptedRows.length,
      debitCount: 1,
      creditCount: 1,
      totalDebit: synced.totalDebit,
      totalCredit: synced.totalCredit,
      openingBalance: 50,
      currency: "USD",
      closing: synced.closing,
      issueDate: "05/08/2026",
      issueDateHijri: "٢٢ محرم ١٤٤٨ هـ",
    });
    expect(payload).toContain("V2|B=KIB|D=T");
    expect(payload).toContain("P=1/1");
    expect(payload).toContain("L=125.00");
    expect(payload).not.toContain("F=");
    expect(payload).toContain("R=BAK-ACCT-20260804-00");
    expect(payload).toContain("N=Client");
    expect(payload.length).toBeLessThan(180);
    expect(payload).not.toContain("٢٢ محرم");
    const statusPayload = buildVerificationQrPayload({
      reference: "BAK-ACCT-20260804-0001",
      accountNumber: "1001",
      customerName: "Client",
      documentType: "status",
      pageNumber: 1,
      pageCount: 1,
      periodStart: "04/08/2026",
      periodEnd: "05/08/2026",
      transactionCount: 2,
      debitCount: 1,
      creditCount: 1,
      totalDebit: 25,
      totalCredit: 100,
      openingBalance: 50,
      currency: "USD",
      closing: 125,
      issueDate: "05/08/2026",
      issueDateHijri: "٢٢ محرم ١٤٤٨ هـ",
    });
    expect(statusPayload).toContain("B=KIB");
    expect(statusPayload).not.toContain("TRAINING");
    expect(statusPayload).toContain("V2|B=KIB|D=S");
    const barcode = buildVerificationBarcodePayload(
      "BAK-ACCT-20260804-0001",
      1,
      3
    );
    expect(
      barcode.startsWith("V2|B=KIB|D=STMT|R=BAK-ACCT-20260804-0001|P=1/3|C=")
    ).toBe(true);
    expect(barcode).not.toContain("TRAINING");
    expect(barcode.slice(-8)).toMatch(/^[0-9A-F]{8}$/);
  });

  it("uses Yemen Commercial Bank identity for YCB QR and barcode payloads", () => {
    const qr = buildVerificationQrPayload({
      bankName: "YEMEN COMMERCIAL BANK",
      reference: "YCB-2026-001",
      accountNumber: "YCB-1001",
      transactionCount: 0,
      currency: "YER",
      closing: 0,
    });
    const barcode = buildVerificationBarcodePayload(
      "YCB-2026-001",
      1,
      1,
      "YEMEN COMMERCIAL BANK"
    );
    expect(qr.startsWith("V2|B=YCB|D=T|")).toBe(true);
    expect(qr).not.toContain("KURAIMI ISLAMIC BANK");
    expect(barcode.startsWith("V2|B=YCB|D=STMT|R=YCB-2026-001|P=1/1|C=")).toBe(
      true
    );
    expect(barcode).not.toContain("KURAIMI ISLAMIC BANK");
  });

  it("keeps YCB QR and barcode payloads distinct while carrying page references", () => {
    const input = {
      customerName: "Ahmed Al-Qahtani",
      passport: "P1234567",
      address: "Sana'a",
      accountNumber: "YCB-1001",
      branchName: "AL-ZUBAIRI",
      currency: "YER",
      statementReference: "YCB-2026-001",
      pageNumber: 1,
      pageCount: 2,
      periodStart: "01-Jan-26",
      periodEnd: "31-Jan-26",
      issueDate: "31-Jan-26",
      firstReference: "0379297",
      lastReference: "0379302",
      transactionCount: 6,
      creditCount: 2,
      debitCount: 4,
      totalCredit: 9032,
      totalDebit: 4400,
      openingBalance: 15283,
      closingBalance: 19915,
    };
    const qr = buildYcbStatementQrPayload(input);
    const barcode = buildYcbStatementBarcodePayload(input);
    expect(qr).toContain("N=Ahmed Al-Qahtani");
    expect(qr).not.toContain("F=");
    expect(qr).toContain("L=19915.00");
    expect(barcode).toContain("V2|B=YCB|D=T|R=YCB-2026-001|P=1/2");
    expect(barcode).toContain("L=19915.00");
    expect(barcode).not.toContain("N=Ahmed Al-Qahtani");
    expect(qr).not.toBe(barcode);
    expect(
      buildYcbStatementBarcodePayload({ ...input, pageNumber: 2 })
    ).not.toBe(barcode);
  });
});
