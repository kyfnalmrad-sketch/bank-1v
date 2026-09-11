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
  });
});
