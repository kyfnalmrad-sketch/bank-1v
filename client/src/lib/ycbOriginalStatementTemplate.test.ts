import { describe, expect, it } from "vitest";
import { renderOriginalYcbStatementPage } from "./ycbOriginalStatementTemplate";

describe("approved YCB statement template", () => {
  it("replaces the sample statement rows and preserves code assets while loading", () => {
    const html = renderOriginalYcbStatementPage({
      customerName: "Live Customer",
      passport: "P1234567",
      address: "Live Address",
      dateOfBirth: "12-Apr-1988",
      branchName: "LIVE BRANCH",
      accountNumber: "LIVE-001",
      accountType: "Savings Account",
      currency: "USD",
      periodStart: "01/09/2026",
      periodEnd: "10/09/2026",
      statementReference: "LIVE-REF",
      openingBalance: 100,
      closingBalance: 125,
      totalCredit: 50,
      totalDebit: 25,
      issueDate: "10/09/2026",
    }, [{ date: "10/09/2026", reference: "LIVE-ROW-1", description: "Live transaction", credit: 50, debit: 0, balance: 125 }], 1, 1);
    expect(html).toContain("LIVE-ROW-1");
    expect(html).toContain("Live Customer");
    expect(html).toContain("P1234567");
    expect(html).toContain("Savings Account");
    expect(html).toContain("Issue Date: 10/09/2026");
    expect(html).not.toContain("0379283");
    expect(html).toContain('class="address-qr"');
    expect(html).toContain('class="title-pdf417"');
  });

  it("hides the passport row when no passport number is provided", () => {
    const html = renderOriginalYcbStatementPage({
      customerName: "Customer Without Passport",
      passport: "",
      address: "Live Address",
      dateOfBirth: "12-Apr-1988",
      branchName: "LIVE BRANCH",
      accountNumber: "LIVE-002",
      accountType: "Savings Account",
      currency: "USD",
      periodStart: "01/09/2026",
      periodEnd: "10/09/2026",
      statementReference: "LIVE-REF-2",
      openingBalance: 100,
      closingBalance: 100,
      totalCredit: 0,
      totalDebit: 0,
      issueDate: "10/09/2026",
    }, [], 1, 1);
    expect(html).not.toContain("Passport Number:");
  });
});
