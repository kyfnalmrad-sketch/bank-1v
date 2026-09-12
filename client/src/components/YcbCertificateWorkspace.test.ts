import { describe, expect, it } from "vitest";
import { renderYcbCertificateHtml, type YcbClient } from "./YcbCertificateWorkspace";
import { buildYcbCertificateQrPayload } from "@/lib/documentSync";

const demoClient: YcbClient = {
  name: "Ahmed Mohammed Al-Qahtani",
  passport: "P1234567",
  branch: "Sana’a Main Branch",
  customerSince: "15/01/2020",
  dateOfBirth: "1988-04-12",
  placeOfBirth: "Sana'a, Yemen",
  accountNumber: "YCB-0045827319",
  accountType: "Current Account",
  currency: "YER",
  opening: "1250000",
  issueDate: "08 September 2026",
  referenceNumber: "YCB-DEMO-2026-091",
  customerServiceName: "Sarah Abdullah Al-Maqtari",
  branchManagerName: "Khaled Ali Al-Hadrami",
  periodStart: "2026-01-01",
  periodEnd: "2026-08-31",
};

describe("YCB certificate data placement", () => {
  it("builds a compact official QR payload from certificate fields", () => {
    const payload = buildYcbCertificateQrPayload({ customerName: demoClient.name, accountNumber: demoClient.accountNumber, currency: demoClient.currency, balance: demoClient.opening, referenceNumber: demoClient.referenceNumber, issueDate: demoClient.issueDate });
    expect(payload).toContain("B=YCB|D=C");
    expect(payload).toContain("N=Ahmed Al-Qahtani");
    expect(payload).toContain("A=YCB-0045827319");
    expect(payload).toContain("R=YCB-DEMO-2026-091");
    expect(payload).not.toContain("BANK_CERTIFICATE");
    expect(payload.length).toBeLessThan(150);
  });
  it("places optional passport and birth date inside the certificate statement", () => {
    const html = renderYcbCertificateHtml(demoClient);
    expect(html).toContain("holder of Passport No. P1234567");
    expect(html).toContain("The account holder was born on");
    expect(html).toContain("12 April 1988");
    expect(html).toContain("Sana&#039;a, Yemen");
    expect(html).toContain("This statement covers the account history for the period from");
    expect(html).toContain("31 August 2026");
    expect(html).toContain("Customer since: 15/01/2020");
    expect(html).toContain("Reference:</b> YCB-DEMO-2026-091");
    expect(html).toContain("1,250,000 YER");
    expect(html).toContain("text-decoration:underline");
    expect(html).toContain("margin:5mm 0 0");
    expect(html).toContain("Customer Service");
    expect(html).toContain("Branch Manager");
    expect(html).not.toContain("[PASSPORT_LINE]");
    expect(html).not.toContain("[BIRTH_DATE_LINE]");
    expect(html).not.toContain("Momaiz");
  });

  it("omits optional values cleanly when the fields are empty", () => {
    const html = renderYcbCertificateHtml({ ...demoClient, passport: "", dateOfBirth: "", placeOfBirth: "", referenceNumber: "" });
    expect(html).not.toContain("Passport No.");
    expect(html).not.toContain("The account holder was born on");
    expect(html).not.toContain("Place of birth");
    expect(html).toContain("This statement covers the account history for the period from");
    expect(html).toContain("Customer since: 15/01/2020");
    expect(html).not.toContain("Reference:</b>");
    expect(html).not.toContain("PENDING");
  });

  it("keeps both signature columns when either authorized name is empty", () => {
    const html = renderYcbCertificateHtml({ ...demoClient, customerServiceName: "", branchManagerName: "" });
    expect(html).toContain('<span class="role">Customer Service</span><span class="name">—</span>');
    expect(html).toContain('<span class="role">Branch Manager</span><span class="name">—</span>');
  });

  it("formats USD balances with thousands separators", () => {
    const html = renderYcbCertificateHtml({ ...demoClient, currency: "USD", opening: "2500000" });
    expect(html).toContain("2,500,000 USD");
    expect(html).not.toContain("2500000 USD");
  });
});
