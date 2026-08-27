import { describe, expect, it } from "vitest";
import { renderAccountStatusPreview, renderStatementPreview } from "./documentPreview";
import { assemblePrintableStatementHtml } from "./printDocument";

describe("reference document previews", () => {
  it("escapes client data before it enters the account status HTML", () => {
    const html = renderAccountStatusPreview({ backgroundUri: "/background.png", qrUri: "/qr.png", customerName: "<script>alert(1)</script>", momaizNo: "1504452", passport: "", dateOfBirth: "01/01/1990", customerSince: "15/01/2020", accountType: "Current Account", accountNumber: "100", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", issueDateHijri: "02 صفر 1448 هـ", printTime: "03:00 PM", correspondenceDate: "15/08/2026", opening: 1, credit: 2, debit: 1, closing: 2, enclosurePages: 1, referenceNo: "BAK-ACCT-20260215-4452" });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("issued at the customer’s request");
    expect(html).toContain("th,td{border:1pt solid #6b5297;padding:1.5mm 1.3mm;vertical-align:middle;font-weight:700}");
    expect(html).toContain("02 صفر 1448 هـ");
  });

  it("keeps statement preview rows to the 19 transactions permitted per page", () => {
    const html = renderStatementPreview({ headerUri: "/header.png", qrUri: "/qr.png", customerName: "Client", accountNumber: "1", momaizNo: "2", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", periodStart: "01/08/2026", periodEnd: "15/08/2026", statementReference: "BAK-ACCT-20260801-0001", pageNumber: 1, pageCount: 2, barcodeUri: "/barcode.svg", barcodeLabel: "REF P1 of 2", closing: -20, transactions: Array.from({ length: 21 }, (_, index) => ({ date: "15/08/2026", description: `Transaction ${index + 1}`, operationNumber: `FT260815${String.fromCharCode(65 + (index % 20))}AA`, debit: 0, credit: 1, balance: index === 0 ? -1 : index + 1 })) });
    expect((html.match(/data-operation=/g) || [])).toHaveLength(19);
    expect(html).not.toContain("END OF REPORT");
    expect(html).not.toContain("Please review this statement");
    expect(html).toContain('class="meta-row"><b>Account Currency:</b><span class="meta-value">USD</span>');
    expect(html).toContain('class="meta-row date-row"><b>Date:</b><span class="meta-value">15/08/2026</span>');
    expect(html).not.toContain("Period:</b>");
    expect(html).not.toContain("Statement Ref:</b>");
    expect(html).not.toContain("PAGE 1/2");
    expect(html).toContain("1.00 DR");
    expect(html).not.toContain("20.00 DR");
    expect(html).toContain("width:56mm;height:9.2mm");
    expect(html).toContain("REF P1 of 2");
    expect(html).toContain("grid-template-columns:106mm 72.8mm;column-gap:8mm");
    expect(html).toContain("clip-path:inset(0 0 22% 0)");
    expect(html).toContain("border:.6pt solid #6d6d86;border-radius:4mm");
    expect(html).toContain('class="right-meta"');
    expect(html).toContain(".right-meta .meta-row{display:grid;grid-template-columns:31mm minmax(0,1fr);column-gap:3mm");
    expect(html).toContain('class="meta-row branch-row"><b>Branch Name:</b><span class="meta-value">HADDAH</span>');
    expect(html).toContain('class="meta-row"><b>Account Currency:</b><span class="meta-value">USD</span>');
    expect(html).toContain('class="meta-row date-row"><b>Date:</b><span class="meta-value">15/08/2026</span>');
    expect(html).toContain('<div class="meta-field"><b>Customer Name:</b><span class="field-value">Client</span></div>');
    expect(html).toContain(".left-meta{display:grid;grid-template-rows:auto auto auto;align-content:start;gap:1mm");
    expect(html).toContain(".notice{width:149.01mm;min-height:7.2mm;margin:2.4mm 0 0 43.95mm");
    const finalPage = renderStatementPreview({ headerUri: "/header.png", qrUri: "/qr.png", customerName: "Client", accountNumber: "1", momaizNo: "2", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", periodStart: "01/08/2026", periodEnd: "15/08/2026", statementReference: "BAK-ACCT-20260801-0001", pageNumber: 2, pageCount: 2, barcodeUri: "/barcode.svg", barcodeLabel: "REF P2 of 2", closing: -20, transactions: [{ date: "16/08/2026", description: "Cash deposit by customer", operationNumber: "FT260816UAA", debit: 0, credit: 20, balance: -20 }] });
    expect(finalPage).toContain("END OF REPORT");
    expect(finalPage).toContain("Please review this statement");
    expect(finalPage).toContain("20.00 DR");
    expect(finalPage).toContain(".end{width:149.01mm;margin-left:43.95mm;padding-bottom:2.2mm;border-bottom:3pt solid #002060");
    expect(finalPage.indexOf('<section class="end">')).toBeLessThan(finalPage.indexOf('<p class="notice">'));
    const printable = assemblePrintableStatementHtml([html, finalPage]);
    expect((printable.match(/class="page"/g) || [])).toHaveLength(2);
    expect((printable.match(/data-operation="FT260816UAA"/g) || [])).toHaveLength(1);
  });
});
