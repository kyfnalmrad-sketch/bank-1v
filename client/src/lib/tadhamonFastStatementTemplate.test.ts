import { describe, expect, it } from "vitest";
import { renderTadhamonFastStatement } from "./tadhamonFastStatementTemplate";

describe("Tadhamon quick statement template", () => {
  it("includes the person number and keeps the account number on one line", () => {
    const html = renderTadhamonFastStatement({
      customerName: "Sample Customer",
      passport: "PERSON-123",
      address: "Sana'a",
      placeOfBirth: "Sana'a",
      dateOfBirth: "12 April 1988",
      branchName: "Main Branch",
      accountNumber: "0000000000",
      accountType: "Current Account",
      currency: "YER",
      periodStart: "01 January 2026",
      periodEnd: "31 August 2026",
      statementReference: "BAK-ACCT-20260101-0000",
      openingBalance: 0,
      closingBalance: 0,
      totalCredit: 0,
      totalDebit: 0,
      issueDate: "11 September 2026",
      qrUri: "data:image/png;base64,TEST",
    }, []);

    expect(html).toContain("Account Opening Date");
    expect(html).toContain("Reference");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("Total Balance:");
    expect(html).toContain("class=\"qr-image\"");
    expect(html).toContain("data:image/png;base64,TEST");
    expect(html).toContain('style="grid-column:1 / span 2"');
    expect(html).toContain('style="grid-column:6"');
    expect(html).toContain('style="grid-column:7"');
    expect(html.indexOf("Account Opening Date")).toBeLessThan(html.indexOf("Opening Balance"));
    expect(html.indexOf("Opening Balance")).toBeLessThan(html.indexOf("Account Number"));
  });
  it("splits after 35 real operations without empty rows", () => {
    const rows = Array.from({ length: 36 }, (_, index) => ({ date: "01/01/2026", reference: `R-${index + 1}`, description: `Operation ${index + 1}`, credit: 100, debit: 0, balance: 100 }));
    const html = renderTadhamonFastStatement({ customerName: "Test", accountNumber: "A", openingBalance: 0, closingBalance: 100, totalCredit: 3600, totalDebit: 0, issueDate: "01 January 2026", qrUri: "" }, rows, {}, 35);
    expect((html.match(/class="page"/g) || []).length).toBe(2);
    expect(html).toContain("Operation 35");
    expect(html).toContain("Operation 36");
    expect(html).not.toContain("empty-row");
    expect(html).not.toContain("&nbsp;");
  });

});
