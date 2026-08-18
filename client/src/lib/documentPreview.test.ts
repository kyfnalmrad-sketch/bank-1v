import { describe, expect, it } from "vitest";
import { renderAccountStatusPreview, renderStatementPreview } from "./documentPreview";

describe("reference document previews", () => {
  it("escapes client data before it enters the account status HTML", () => {
    const html = renderAccountStatusPreview({ backgroundUri: "/background.png", qrUri: "/qr.png", customerName: "<script>alert(1)</script>", momaizNo: "1504452", passport: "", dateOfBirth: "01/01/1990", customerSince: "15/01/2020", accountType: "Current Account", accountNumber: "100", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", issueDateHijri: "02 صفر 1448 هـ", printTime: "03:00 PM", correspondenceDate: "15/08/2026", opening: 1, credit: 2, debit: 1, closing: 2, enclosurePages: 1, referenceNo: "BAK-ACCT-20260215-4452" });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("issued at the customer’s request");
    expect(html).toContain("td{font-weight:600}");
    expect(html).toContain("02 صفر 1448 هـ");
  });

  it("keeps statement preview rows to the 20 transactions permitted per page", () => {
    const html = renderStatementPreview({ headerUri: "/header.png", qrUri: "/qr.png", customerName: "Client", accountNumber: "1", momaizNo: "2", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", periodStart: "01/08/2026", periodEnd: "15/08/2026", statementReference: "BAK-ACCT-20260801-0001", pageNumber: 1, pageCount: 2, closing: 20, transactions: Array.from({ length: 21 }, (_, index) => ({ date: "15/08/2026", description: `Transaction ${index + 1}`, operationNumber: `FT${index + 1}`, debit: 0, credit: 1, balance: index + 1 })) });
    expect((html.match(/data-operation=/g) || [])).toHaveLength(20);
    expect(html).toContain("END OF REPORT");
    expect(html).toContain("Account Currency:</b> USD");
    expect(html).toContain("Date:</b> 15/08/2026");
    expect(html).not.toContain("Period:</b>");
    expect(html).not.toContain("Statement Ref:</b>");
    expect(html).not.toContain("PAGE 1/2");
  });
});
