import { describe, expect, it } from "vitest";
import { renderYcbStatementPages } from "./YcbStatementWorkspace";

const profile = {
  customerName: "Preview Customer",
  passport: "",
  address: "Sana'a",
  dateOfBirth: "",
  branchName: "AL-ZUBAIRI",
  accountNumber: "101-840-21102-326491-000",
  accountType: "Current Account",
  currency: "USD",
  periodStart: "01-Sep-2026",
  periodEnd: "10-Sep-2026",
  statementReference: "YCB-PREVIEW-001",
  openingBalance: 100,
  closingBalance: 120,
  totalCredit: 25,
  totalDebit: 5,
  issueDate: "10-Sep-2026",
};

describe("YCB statement preview assembly", () => {
  it("keeps every approved page in one printable document", () => {
    const transactions = Array.from({ length: 19 }, (_, index) => ({
      date: "10-Sep-2026",
      reference: `REF-${index + 1}`,
      description: `Transaction ${index + 1}`,
      credit: index === 18 ? 20 : 0,
      debit: index === 18 ? 0 : 5,
      balance: 100 + index,
    }));
    const html = renderYcbStatementPages(profile, transactions);

    expect(html.match(/<html/gi)).toHaveLength(1);
    expect(html).toContain("Page 1 of 2");
    expect(html).toContain("Page 2 of 2");
    expect(html).toContain("REF-1");
    expect(html).toContain("REF-19");
  });
});
