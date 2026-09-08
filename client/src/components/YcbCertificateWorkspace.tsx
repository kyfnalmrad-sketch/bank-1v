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
  const values: Record<string, string> = {
    "[CUSTOMER_NAME]": client.name,
    "[ACCOUNT_TYPE]": client.accountType,
    "[ACCOUNT_NUMBER]": client.accountNumber,
    "[BALANCE_IN_WORDS]": "One Million Two Hundred Fifty Thousand Yemeni Rials",
    "[BALANCE_NUMERIC]": client.opening || "0.00",
    "[CURRENCY]": client.currency,
    "[AS_OF_DATE]": client.issueDate,
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
    <div className="bank-workspace-heading"><div><p className="eyebrow">YEMEN COMMERCIAL BANK</p><h2>بيانات وإصدار الشهادة الرسمية</h2><p className="hint">القالب أدناه هو قالب YCB الرسمي الأصلي، والمدخلات مرتبطة به مباشرة.</p></div><button type="button" className="secondary-button" onClick={onBack}><ArrowRight size={16} /> اختيار بنك آخر</button></div>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>بيانات العميل والحساب / Customer & Account Details</h2><p className="hint">نفس تنسيق مدخلات النظام الأصلي، بدون رقم المميز الخاص بالكريمي.</p></div><FileText size={26} className="heading-icon" /></div><div className="grid">
      <label>اسم العميل / Customer name<input value={client.name} onChange={(e) => onChange("name", e.target.value)} /></label>
      <label>رقم الجواز / Passport number <span className="field-note">اختياري / Optional</span><input dir="ltr" value={client.passport} onChange={(e) => onChange("passport", e.target.value)} /></label>
      <label>اسم الفرع / Branch name<input dir="ltr" value={client.branch} onChange={(e) => onChange("branch", e.target.value)} /></label>
      <label>تاريخ بدء العميل / Customer since<input value={client.customerSince} onChange={(e) => onChange("customerSince", e.target.value)} /></label>
      <label>تاريخ الميلاد / Date of birth <span className="field-note">اختياري / Optional</span><input type="date" value={client.dateOfBirth} onChange={(e) => onChange("dateOfBirth", e.target.value)} /></label>
      <label>نوع الحساب / Account type<input dir="ltr" value={client.accountType} onChange={(e) => onChange("accountType", e.target.value)} /></label>
      <label>رقم الحساب / Account number<input dir="ltr" value={client.accountNumber} onChange={(e) => onChange("accountNumber", e.target.value)} /></label>
      <label>العملة / Currency<select value={client.currency} onChange={(e) => onChange("currency", e.target.value)}><option>YER</option><option>USD</option><option>SAR</option></select></label>
      <label>الرصيد / Balance<input dir="ltr" value={client.opening} onChange={(e) => onChange("opening", e.target.value)} /></label>
      <label>رقم المراجعة / Reference number<input dir="ltr" value={client.referenceNumber} onChange={(e) => onChange("referenceNumber", e.target.value)} /></label>
      <label>تاريخ الإصدار / Issue date<input value={client.issueDate} onChange={(e) => onChange("issueDate", e.target.value)} /></label>
      <label>Customer Service<input value={client.customerServiceName} onChange={(e) => onChange("customerServiceName", e.target.value)} /></label>
      <label>Branch Manager<input value={client.branchManagerName} onChange={(e) => onChange("branchManagerName", e.target.value)} /></label>
    </div><div className="actions"><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "إخفاء المعاينة" : "عرض المعاينة"}</button><button type="button" onClick={print}><Printer size={17} /> طباعة / حفظ PDF</button></div></section>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>معاينة قالب YCB الرسمي</h2><p className="hint">هذه المعاينة تستخدم نفس HTML والصور الموجودة في المعاينة الرسمية الأصلية.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Official Yemen Commercial Bank certificate preview" srcDoc={html} /></div></section>}
  </main>;
}

export function BankSelector({ onSelect, onLogout }: { onSelect: (bank: "karimi" | "ycb") => void; onLogout: () => void }) {
  return <main className="bank-selector" dir="rtl"><section className="bank-selector-card"><div className="system-mark"><FileText size={30} /></div><p className="eyebrow">منصة إصدار ومراجعة الكشوف</p><h1>اختر البنك</h1><p className="hint">كل مساحة مستقلة، مع الحفاظ على نفس نمط الإدخال والمعاينة والطباعة.</p><div className="bank-choice-grid"><button type="button" onClick={() => onSelect("karimi")}><strong>بنك الكريمي</strong><span>نظام الكشوف الحالي</span></button><button type="button" onClick={() => onSelect("ycb")}><strong>بنك اليمن التجاري</strong><span>القالب الرسمي ومدخلات YCB</span></button></div><section className="bank-data-table-wrap"><h2>فصل البيانات والاستعادة</h2><p className="hint">كل بنك يستعيد Snapshot وHistory والعمليات إلى مساره فقط.</p><table className="bank-data-table"><thead><tr><th>البنك</th><th>Snapshot</th><th>History</th><th>Excel / العمليات</th><th>رقم المراجعة</th></tr></thead><tbody><tr><td><strong>الكريمي</strong></td><td>مساحة Karimi</td><td>سجلات Karimi</td><td>محرك الكريمي</td><td>خاص بالكريمي</td></tr><tr><td><strong>اليمن التجاري</strong></td><td>مساحة YCB</td><td>سجلات YCB</td><td>نفس المحرك / مستقل</td><td>خاص بـYCB</td></tr></tbody></table></section><button type="button" className="secondary-button" onClick={onLogout}>تسجيل الخروج</button></section></main>;
}

export default YcbCertificateWorkspace;
