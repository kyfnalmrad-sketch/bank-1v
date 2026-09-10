import { describe, expect, it } from "vitest";
import { renderOriginalYcbStatementPage } from "./ycbOriginalStatementTemplate";

describe("approved YCB statement template", () => {
  it("replaces the sample statement rows and preserves code assets while loading", () => {
    const html = renderOriginalYcbStatementPage({
      customerName: "Live Customer",
      passport: "",
      address: "Live Address",
      dateOfBirth: "",
      branchName: "LIVE BRANCH",
      accountNumber: "LIVE-001",
      accountType: "Current Account",
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
    expect(html).not.toContain("0379283");
    expect(html).toContain('class="address-qr"');
    expect(html).toContain('class="title-pdf417"');
  });
});
