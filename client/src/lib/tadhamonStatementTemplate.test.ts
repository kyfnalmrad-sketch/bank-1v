import { describe, expect, it } from "vitest";
import { renderTadhamonStatementPages } from "./tadhamonStatementTemplate";

describe("Tadhamon statement template", () => {
  it("renders supplied data and never uses another bank identity", () => {
    const html = renderTadhamonStatementPages({
      customerName: "عميل التضامن", passport: "P-1", address: "صنعاء", dateOfBirth: "", branchName: "فرع التحرير", accountNumber: "TAD-001", accountType: "Current Account", currency: "YER", periodStart: "2026-01-01", periodEnd: "2026-01-31", statementReference: "TAD-STMT-001", openingBalance: 100, closingBalance: 125, totalCredit: 50, totalDebit: 25, issueDate: "2026-02-01",
    }, [{ date: "2026-01-02", reference: "1", description: "إيداع", credit: 50, debit: 0, balance: 150 }], ["qr-data"], ["barcode-data"]);
    expect(html).toContain("Tadhamon Bank");
    expect(html).toContain("عميل التضامن");
    expect(html).toContain("TAD-STMT-001");
    expect(html).not.toContain("KURAIMI");
    expect(html).not.toContain("Yemen Commercial Bank");
    expect(html).not.toContain("Ahmed Mohammed Al-Qahtani");
  });
});
