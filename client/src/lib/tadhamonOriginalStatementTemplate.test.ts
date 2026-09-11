import { describe, expect, it } from "vitest";
import { renderOriginalTadhamonStatementPage, renderTadhamonStatementPages } from "./tadhamonOriginalStatementTemplate";

describe("approved Tadhamon statement template", () => {
  const profile = {
    customerName: "Live Customer",
    passport: "P1234567",
    address: "Sana'a — Bab Al-Yemen",
    dateOfBirth: "",
    placeOfBirth: "",
    branchName: "AL-ZUBAIRI",
    accountNumber: "101-840-21102-326491-000",
    accountType: "Personal Current Account",
    currency: "USD",
    periodStart: "05-Feb-2025",
    periodEnd: "24-Jun-2025",
    statementReference: "TAD-STMT-2025-001",
    openingBalance: 3500,
    closingBalance: 23231,
    totalCredit: 13548,
    totalDebit: 5600,
    issueDate: "11-Sep-2026",
    printTime: "05:30:00",
  };

  it("uses live rows and renders passport and print metadata", () => {
    const html = renderOriginalTadhamonStatementPage(profile, [{ date: "05-Feb-25", reference: "LIVE-ROW-1", description: "Live transaction", credit: 50, debit: 0, balance: 125 }], 1, 1);
    expect(html).toContain("LIVE-ROW-1");
    expect(html).toContain("P1234567");
    expect(html).toContain("05:30:00");
    expect(html).toContain("11-Sep-2026");
    expect(html).toContain("Passport Number:");
    expect(html).toContain("Print Date:");
    expect(html).toContain("TAD-STMT-2025-001");
    expect(html).toContain("class=\"code-sum\"");
    expect(html).not.toContain("summary-barcode");
  });

  it("limits the Tadhamon statement to 15 transactions on one page", () => {
    const transactions = Array.from({ length: 18 }, (_, index) => ({
      date: "05-Feb-25",
      reference: `LIVE-ROW-${index + 1}`,
      description: `Transaction ${index + 1}`,
      credit: 0,
      debit: 1,
      balance: 100 - index,
    }));
    const pages = renderTadhamonStatementPages(profile, transactions);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain("LIVE-ROW-15");
    expect(pages[0]).not.toContain("LIVE-ROW-16");
    expect(pages[1]).toContain("LIVE-ROW-16");
    expect(pages[1]).toContain("Page 2 of 2");
    expect(pages.join("\n")).not.toContain("summary-barcode");
  });

  it("omits the passport field when no passport is supplied", () => {
    const html = renderOriginalTadhamonStatementPage({ ...profile, passport: "" }, [], 1, 1);
    expect(html).not.toContain("Passport Number:");
    expect(html).toContain("Print Time:");
  });
});
