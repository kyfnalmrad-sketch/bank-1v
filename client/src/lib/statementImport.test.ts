import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { bankStatementReference, buildImportedTransactions, discoverStatementHeader, displayStatementDate, extractStatementProfile, formatEnglishGregorianDate, formatHijriDate, formatImportedDate, reviewDescription, statementReferenceFromTransactions } from "./statementImport";

describe("statement Excel import", () => {
  it("selects the actual Arabic heading row after preface rows without inventing columns", () => {
    const matrix = [["كشف تجريبي — معلومات إضافية", "", "", "", ""], ["مصرف الكريمي", "", "", "", ""], ["", "", "", "", ""], ["تاريخ الحركة", "وصف العملية", "مدين", "دائن", "المرجع الخارجي"], ["2026/01/05", "إيداع راتب يناير", "", "١٬٥٠٠.٥٠", "INV-100"]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.headerRowIndex).toBe(3);
    expect(discovered?.headers).toEqual(["تاريخ الحركة", "وصف العملية", "مدين", "دائن", "المرجع الخارجي"]);
    expect(discovered?.map).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, reference: 4 });
  });

  it("extracts supported customer and summary fields from a two-column preface", () => {
    const matrix = [["Customer Name", "Sample Customer"], ["Account Number", "0000000000"], ["Opening Balance", "3500"], ["Closing Balance", "23231"], ["Date", "Description", "Debit", "Credit", "Balance"], ["2026-02-01", "Deposit", "", "100", "3600"]];
    expect(extractStatementProfile(matrix, 4)).toMatchObject({ customerName: "Sample Customer", accountNumber: "0000000000", openingBalance: "3500", closingBalance: "23231" });
  });

  it("ignores One, Two and Three headings and rejects an ambiguous duplicate heading row", () => {
    const oneTwoThree = [["One", "Two", "Three", "Date", "Description", "Amount", "Type"], ["ignored", "ignored", "ignored", "2026-02-15", "Cash deposit", "10", "Credit"]];
    expect(discoverStatementHeader(oneTwoThree)?.headers).toEqual(["Date", "Description", "Amount", "Type"]);
    const ambiguous = [["Date", "Description", "Debit", "Credit"], ["Date", "Description", "Debit", "Credit"]];
    expect(discoverStatementHeader(ambiguous)).toBeNull();
  });

  it("infers the usual Date, Particular, reference, debit, credit and balance layout from the uploaded-ledger pattern", () => {
    const matrix = [["Preface", "", "", "", "", ""], ["Different 1", "Different 2", "Different 3", "Different 4", "Different 5", "Different 6"], [46057, "ATM withdrawal", "FT260204Z8BT", 255.15, "", -102.31], [46058, "Incoming: Mohammed Al-Muhaya", "FT260205IYTO", "", 181.44, 79.13]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.headerRowIndex).toBe(1);
    expect(discovered?.map).toMatchObject({ date: 0, description: 1, reference: 2, debit: 3, credit: 4, balance: 5 });
  });

  it("detects and imports an optional Branch column from Excel", () => {
    const matrix = [["Date", "Movement Description", "Branch", "Ref No.", "Debit", "Credit", "Balance"], ["2026-08-01", "Cash deposit", "Br. Maalla", "OP-1001", "", "100", "100"]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.map).toMatchObject({ date: 0, description: 1, branch: 2 });
    expect(buildImportedTransactions(matrix.slice(1), discovered!.map)[0].branch).toBe("Br. Maalla");
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
    expect(reviewDescription("تحويل عائلي من أحمد محمد")).toMatchObject({ accepted: true, suggestedDescription: "Family transfer — أحمد محمد" });
    expect(reviewDescription("دفع مشتريات عبر تطبيق حاسب")).toMatchObject({ accepted: true, suggestedDescription: "Payment via Haseb" });
    expect(reviewDescription("Family: Abdullah Al-Matari")).toMatchObject({ accepted: true, suggestedDescription: "Family transfer — Abdullah Al-Matari" });
    expect(reviewDescription("Personal: Abdulnasser Saeed")).toMatchObject({ accepted: true, suggestedDescription: "Personal transfer — Abdulnasser Saeed" });
    expect(reviewDescription("Utility bill payment").accepted).toBe(false);
  });

  it("derives a stable statement reference from the imported date instead of the external transaction reference", () => {
    const reference = statementReferenceFromTransactions([{ date: "2026-02-15" }], "1504452");
    expect(reference).toBe("BAK-ACCT-20260215-4452");
  });

  it("generates a bank-specific statement reference from account, name, and last operation", () => {
    expect(bankStatementReference("tadhamon", "123456789", "Ahmed Saleh", "TAD-REF-9001")).toMatch(/^TD-1234-AS-\d{6}$/);
    expect(bankStatementReference("ycb", "987654321", "Mona Ali", "YC-77")).toMatch(/^YC-9876-MA-\d{6}$/);
    expect(bankStatementReference("karimi", "55", "Noura", "FT0001")).toMatch(/^KR-5500-NN-\d{6}$/);
    expect(bankStatementReference("tadhamon", "123456789", "Ahmed Saleh", "TAD-REF-9002")).not.toBe(bankStatementReference("tadhamon", "123456789", "Ahmed Saleh", "TAD-REF-9001"));
  });

  it("generates date-based non-sequential FT operation numbers without using the Excel reference", () => {
    const transactions = buildImportedTransactions([
      ["04/02/2026", "Cash deposit", "EXCEL-REF-ONE", "", 100, 100],
      ["04/02/2026", "ATM withdrawal", "EXCEL-REF-TWO", 25, "", 75],
    ], { date: 0, description: 1, reference: 2, debit: 3, credit: 4, balance: 5 });
    expect(transactions.map((transaction) => transaction.operationNumber)).toEqual(expect.arrayContaining([expect.stringMatching(/^FT260204[A-Z]{3}$/)]));
    expect(transactions[0].operationNumber).not.toBe(transactions[1].operationNumber);
    expect(transactions.map((transaction) => transaction.operationNumber).join(" ")).not.toContain("EXCEL-REF");
    expect(transactions.map((transaction) => transaction.operationNumber).join(" ")).not.toContain("FT000001");
  });

  it("uses the Excel reference as the operation number when Excel is the selected reference source", () => {
    const transactions = buildImportedTransactions([
      ["04/02/2026", "Cash deposit", "TAD-OP-1001", "", 100, 100],
    ], { date: 0, description: 1, reference: 2, debit: 3, credit: 4, balance: 5 }, true);
    expect(transactions[0]).toMatchObject({ externalReference: "TAD-OP-1001", operationNumber: "TAD-OP-1001" });
  });

  it("recognizes Operation No. as the Excel operation reference column", () => {
    const matrix = [["Date", "Description", "Operation No.", "Debit", "Credit", "Balance"], ["2026-02-04", "Cash deposit", "TAD-000045", "", 100, 100]];
    const discovered = discoverStatementHeader(matrix);
    expect(discovered?.map.reference).toBe(2);
    expect(buildImportedTransactions(matrix.slice(1), discovered!.map, true)[0].operationNumber).toBe("TAD-000045");
  });

  it("stores imported Excel dates in ISO format for native date editing", () => {
    expect(formatImportedDate(46057)).toBe("2026-02-04");
    expect(formatImportedDate("04/08/2026")).toBe("2026-08-04");
    expect(formatImportedDate("2026/08/04")).toBe("2026-08-04");
  });

  it("keeps the original Excel date so later edits can be flagged", () => {
    const transaction = buildImportedTransactions([["2026-08-04", "Cash deposit", "TAD-1", "", 100, 100]], { date: 0, description: 1, reference: 2, debit: 3, credit: 4, balance: 5 }, true)[0];
    expect(transaction.sourceDate).toBe("2026-08-04");
  });

  it("renders ISO transaction dates separately as an English statement date", () => {
    expect(displayStatementDate("2026-08-04")).toBe("04/08/2026");
  });

  it("formats Gregorian status dates with an English month name", () => {
    expect(formatEnglishGregorianDate("2026-08-04")).toBe("4 August 2026");
    expect(formatEnglishGregorianDate("04/08/2026")).toBe("4 August 2026");
  });

  it("converts a Gregorian issue date to an Um Al-Qura Hijri date with the هـ suffix", () => {
    expect(formatHijriDate("2026-08-04")).toBe("٢١ صفر ١٤٤٨ هـ");
    expect(formatHijriDate("not-a-date")).toBe("");
  });

  const suppliedFiles = [
    "/home/ubuntu/upload/trainingantledgeryeenibeneficiaries.xlsx",
    "/home/ubuntu/upload/trainingantledgeryeenibZZciaries.xlsx",
    "/home/ubuntu/upload/trainingantledgeryeenineficiaries.xlsx",
    "/home/ubuntu/upload/training_account_ledger(7).xlsx",
    "/home/ubuntu/upload/training_ant_ledger_yeeni_beneficiaries.xlsx",
  ];
  const testSuppliedFiles = suppliedFiles.every(existsSync) ? it.each(suppliedFiles) : it.skip;
  testSuppliedFiles("imports the supplied ledger structure: %s", (filePath) => {
    const workbook = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
    const discovered = discoverStatementHeader(rows);
    expect(discovered).not.toBeNull();
    expect(discovered?.map.date).toBeDefined();
    expect(discovered?.map.description).toBeDefined();
    expect(discovered?.map.debit).toBeDefined();
    expect(discovered?.map.credit).toBeDefined();
    const transactions = buildImportedTransactions(rows.slice((discovered?.headerRowIndex ?? 0) + 1), discovered!.map);
    expect(transactions.length).toBeGreaterThan(40);
  });
});
