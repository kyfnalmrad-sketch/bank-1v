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
    }, []);

    expect(html).toContain("Customer ID / Person No.");
    expect(html).toContain("PERSON-123");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("Account: 0000000000");
  });
});
