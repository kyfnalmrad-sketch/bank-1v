import React, { useMemo, useState } from "react";
import { ArrowRight, FileText, Printer } from "lucide-react";
import { openPrintWindow } from "@/lib/printDocument";
import { ycbOfficialCertificateTemplate } from "@/lib/ycbOfficialCertificateTemplate";

export type YcbClient = {
  name: string; passport: string; branch: string; customerSince: string; dateOfBirth: string;
  accountNumber: string; accountType: string; currency: string; opening: string; issueDate: string;
  referenceNumber: string; customerServiceName: string; branchManagerName: string;
};

type Props = { client: YcbClient; onChange: (key: keyof YcbClient, value: string) => void; onBack: () => void };

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderYcbCertificateHtml(client: YcbClient) {
  const issueDate = new Date(client.issueDate);
  const hijriDate = Number.isNaN(issueDate.getTime()) ? "PENDING" : new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(issueDate);
  const values: Record<string, string> = {
    "[CUSTOMER_NAME]": client.name,
    "[ACCOUNT_TYPE]": client.accountType,
    "[ACCOUNT_NUMBER]": client.accountNumber,
    "[BALANCE_IN_WORDS]": "One Million Two Hundred Fifty Thousand Yemeni Rials",
    "[BALANCE_NUMERIC]": client.opening || "0.00",
    "[CURRENCY]": client.currency,
    "[AS_OF_DATE]": client.issueDate,
    "[AS_OF_DATE_HIJRI]": hijriDate,
    "[AUTHORIZED_OFFICER_NAME]": client.customerServiceName,
    "[BRANCH_MANAGER_NAME]": client.branchManagerName,
  };
  let html = ycbOfficialCertificateTemplate
    .replaceAll("ycb-official-letterhead.png", "/assets/ycb-official-letterhead.png")
    .replaceAll("ycb-certificate-qr.png", "/assets/ycb-certificate-qr.png")
    .replace("<div><b>Reference:</b> 4119</div>", `<div><b>Reference:</b> ${escapeHtml(client.referenceNumber || "PENDING")}</div>`)
    .replace("<div><b>DATE:</b> 07 AUG 2025</div>", `<div><b>DATE:</b> ${escapeHtml(client.issueDate || "PENDING")}</div>`);
  for (const [placeholder, value] of Object.entries(values)) html = html.replaceAll(placeholder, escapeHtml(value));
  return html;
}

export function YcbCertificateWorkspace({ client, onChange, onBack }: Props) {
  const [preview, setPreview] = useState(true);
  const html = useMemo(() => renderYcbCertificateHtml(client), [client]);
  const print = () => openPrintWindow(html, "Yemen Commercial Bank Official Certificate");
  return <main className="bank-workspace" dir="rtl">
    <div className="bank-workspace-heading"><div><p className="eyebrow">YEMEN COMMERCIAL BANK</p><h2>Official Certificate Issuance</h2><p className="hint">Enter the customer and account details used directly in the official YCB certificate.</p></div><button type="button" className="secondary-button" onClick={onBack}><ArrowRight size={16} /> Select another bank</button></div>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>Customer & Account Details</h2><p className="hint">All fields below are connected to the English certificate preview.</p></div><FileText size={26} className="heading-icon" /></div><div className="grid">
      <label>Customer name<input value={client.name} onChange={(e) => onChange("name", e.target.value)} /></label>
      <label>Passport number <span className="field-note">Optional</span><input dir="ltr" value={client.passport} onChange={(e) => onChange("passport", e.target.value)} /></label>
      <label>Branch name<input dir="ltr" value={client.branch} onChange={(e) => onChange("branch", e.target.value)} /></label>
      <label>Customer since<input value={client.customerSince} onChange={(e) => onChange("customerSince", e.target.value)} /></label>
      <label>Date of birth <span className="field-note">Optional</span><input type="date" value={client.dateOfBirth} onChange={(e) => onChange("dateOfBirth", e.target.value)} /></label>
      <label>Account type<input dir="ltr" value={client.accountType} onChange={(e) => onChange("accountType", e.target.value)} /></label>
      <label>Account number<input dir="ltr" value={client.accountNumber} onChange={(e) => onChange("accountNumber", e.target.value)} /></label>
      <label>Currency<select value={client.currency} onChange={(e) => onChange("currency", e.target.value)}><option>YER</option><option>USD</option><option>SAR</option></select></label>
      <label>Balance<input dir="ltr" value={client.opening} onChange={(e) => onChange("opening", e.target.value)} /></label>
      <label>Reference number<input dir="ltr" value={client.referenceNumber} onChange={(e) => onChange("referenceNumber", e.target.value)} /></label>
      <label>Issue date<input value={client.issueDate} onChange={(e) => onChange("issueDate", e.target.value)} /></label>
      <label>Customer Service<input value={client.customerServiceName} onChange={(e) => onChange("customerServiceName", e.target.value)} /></label>
      <label>Branch Manager<input value={client.branchManagerName} onChange={(e) => onChange("branchManagerName", e.target.value)} /></label>
    </div><div className="actions"><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "Hide preview" : "Show preview"}</button><button type="button" onClick={print}><Printer size={17} /> Print / Save PDF</button></div></section>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>Official YCB Certificate Preview</h2><p className="hint">This preview uses the official English certificate layout and assets.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Official Yemen Commercial Bank certificate preview" srcDoc={html} /></div></section>}
  </main>;
}

export function BankSelector({ onSelect, onLogout }: { onSelect: (bank: "karimi" | "ycb") => void; onLogout: () => void }) {
  return <main className="bank-selector" dir="rtl"><section className="bank-selector-card"><div className="system-mark"><FileText size={30} /></div><p className="eyebrow">منصة إصدار ومراجعة الكشوف</p><h1>اختر البنك</h1><p className="hint">كل مساحة مستقلة، مع الحفاظ على نفس نمط الإدخال والمعاينة والطباعة.</p><div className="bank-choice-grid"><button type="button" onClick={() => onSelect("karimi")}><strong>بنك الكريمي</strong><span>نظام الكشوف الحالي</span></button><button type="button" onClick={() => onSelect("ycb")}><strong>بنك اليمن التجاري</strong><span>القالب الرسمي ومدخلات YCB</span></button></div><section className="bank-data-table-wrap"><h2>فصل البيانات والاستعادة</h2><p className="hint">كل بنك يستعيد Snapshot وHistory والعمليات إلى مساره فقط.</p><table className="bank-data-table"><thead><tr><th>البنك</th><th>Snapshot</th><th>History</th><th>Excel / العمليات</th><th>رقم المراجعة</th></tr></thead><tbody><tr><td><strong>الكريمي</strong></td><td>مساحة Karimi</td><td>سجلات Karimi</td><td>محرك الكريمي</td><td>خاص بالكريمي</td></tr><tr><td><strong>اليمن التجاري</strong></td><td>مساحة YCB</td><td>سجلات YCB</td><td>نفس المحرك / مستقل</td><td>خاص بـYCB</td></tr></tbody></table></section><button type="button" className="secondary-button" onClick={onLogout}>تسجيل الخروج</button></section></main>;
}

export default YcbCertificateWorkspace;
