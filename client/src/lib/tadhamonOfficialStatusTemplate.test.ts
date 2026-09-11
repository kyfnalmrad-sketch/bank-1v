import { describe, expect, it } from "vitest";
import { renderTadhamonOfficialStatusPreview } from "./tadhamonOfficialStatusTemplate";

describe("Tadhamon official status package", () => {
  it("keeps customer since in the Hijri position and Hijri date in the cyan field", () => {
    const html = renderTadhamonOfficialStatusPreview({
      backgroundUri: "/assets/tadhamon-official-paper.png",
      qrUri: "data:image/png;base64,QR",
      customerName: "SAMPLE CUSTOMER",
      momaizNo: "",
      passport: "",
      dateOfBirth: "12 April 1988",
      placeOfBirth: "Sana'a, Yemen",
      customerSince: "01 January 2024",
      periodStart: "01 January 2026",
      periodEnd: "31 August 2026",
      accountType: "Current Account",
      accountNumber: "0000000000",
      branchName: "Main Branch",
      currency: "YER",
      issueDate: "11 September 2026",
      issueDateHijri: "٢٩ ربيع الأول ١٤٤٨ هـ",
      printTime: "09:23",
      correspondenceDate: "01 January 2026",
      opening: 0,
      credit: 0,
      debit: 0,
      closing: 0,
      enclosurePages: 1,
      referenceNo: "TAD-STATUS-1",
    });
    expect(html).toContain('<b>Customer since:</b>');
    expect(html).toContain('التاريخ الهجري:');
    expect(html).toContain('color:#8fd3e8');
    expect(html).toContain('12 April 1988');
    expect(html).toContain("Sana&#039;a, Yemen");
    expect(html).toContain('01 January 2026');
    expect(html).toContain('31 August 2026');
  });
});
