import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, LockKeyhole, Printer, Save, UnlockKeyhole } from "lucide-react";
import { openPrintWindow } from "@/lib/printDocument";
import { ycbOfficialCertificateTemplate } from "@/lib/ycbOfficialCertificateTemplate";

export type YcbClient = {
  name: string; passport: string; branch: string; customerSince: string; dateOfBirth: string;
  accountNumber: string; accountType: string; currency: string; opening: string; issueDate: string;
  referenceNumber: string; customerServiceName: string; branchManagerName: string;
};

type Props = { client: YcbClient; onChange: (key: keyof YcbClient, value: string) => void; onBack: () => void };
type LockedField = "customerServiceName" | "branchManagerName";
const defaultsStorageKey = "bak-web-staging-ycb-authorized-defaults";

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatOptionalDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatFinancialAmount(value: string) {
  const numeric = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric) : value || "0.00";
}

function currencyWords(currency: string) {
  return ({ YER: "Yemeni Rials", USD: "US Dollars", SAR: "Saudi Riyals" } as Record<string, string>)[currency] || currency;
}

export function renderYcbCertificateHtml(client: YcbClient) {
  const issueDate = new Date(client.issueDate);
  const hijriDate = Number.isNaN(issueDate.getTime()) ? "PENDING" : new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(issueDate);
  const values: Record<string, string> = {
    "[CUSTOMER_NAME]": client.name,
    "[ACCOUNT_TYPE]": client.accountType,
    "[ACCOUNT_NUMBER]": client.accountNumber,
    "[PASSPORT_LINE]": client.passport ? `, holder of Passport No. ${client.passport}` : "",
    "[BIRTH_DATE_LINE]": client.dateOfBirth ? `, born on ${formatOptionalDate(client.dateOfBirth)}` : "",
    "[CUSTOMER_SINCE_LINE]": client.customerSince.trim() ? `Customer since: ${formatOptionalDate(client.customerSince)}` : "",
    "[BALANCE_IN_WORDS]": `${formatFinancialAmount(client.opening)} ${currencyWords(client.currency)}`,
    "[BALANCE_NUMERIC]": formatFinancialAmount(client.opening),
    "[CURRENCY]": client.currency,
    "[AS_OF_DATE]": client.issueDate,
    "[AS_OF_DATE_HIJRI]": hijriDate,
    "[AUTHORIZED_OFFICER_NAME]": client.customerServiceName.trim() || "—",
    "[BRANCH_MANAGER_NAME]": client.branchManagerName.trim() || "—",
  };
  let html = ycbOfficialCertificateTemplate
    .replaceAll("ycb-official-letterhead.png", "/assets/ycb-official-letterhead.png")
    .replaceAll("ycb-certificate-qr.png", "/assets/ycb-certificate-qr.png")
    .replace("<div><b>Reference:</b> 4119</div>", client.referenceNumber.trim() ? `<div><b>Reference:</b> ${escapeHtml(client.referenceNumber)}</div>` : "")
    .replace("<div><b>DATE:</b> 07 AUG 2025</div>", `<div><b>DATE:</b> ${escapeHtml(client.issueDate || "PENDING")}</div>`);
  for (const [placeholder, value] of Object.entries(values)) html = html.replaceAll(placeholder, escapeHtml(value));
  return html;
}

function readDefaults(): Partial<Pick<YcbClient, LockedField>> {
  try {
    const value = JSON.parse(localStorage.getItem(defaultsStorageKey) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function YcbCertificateWorkspace({ client, onChange, onBack }: Props) {
  const [preview, setPreview] = useState(false);
  const [lockedFields, setLockedFields] = useState<Record<LockedField, boolean>>({ customerServiceName: false, branchManagerName: false });
  const [defaultMessage, setDefaultMessage] = useState("");
  const html = useMemo(() => renderYcbCertificateHtml(client), [client]);

  useEffect(() => {
    const defaults = readDefaults();
    for (const key of ["customerServiceName", "branchManagerName"] as const) {
      if (defaults[key]) onChange(key, String(defaults[key]));
    }
    setLockedFields({ customerServiceName: Boolean(defaults.customerServiceName), branchManagerName: Boolean(defaults.branchManagerName) });
  }, []);

  const saveDefault = (key: LockedField) => {
    const defaults = readDefaults();
    localStorage.setItem(defaultsStorageKey, JSON.stringify({ ...defaults, [key]: client[key] }));
    setLockedFields((current) => ({ ...current, [key]: true }));
    setDefaultMessage(`${key === "customerServiceName" ? "Customer Service" : "Branch Manager"} saved as the YCB default.`);
  };
  const unlock = (key: LockedField) => {
    setLockedFields((current) => ({ ...current, [key]: false }));
    setDefaultMessage("The field is unlocked for editing. Save it again to make it the default.");
  };
  const clearDefault = (key: LockedField) => {
    const defaults = readDefaults();
    delete defaults[key];
    localStorage.setItem(defaultsStorageKey, JSON.stringify(defaults));
    setLockedFields((current) => ({ ...current, [key]: false }));
    setDefaultMessage("The saved default was cleared.");
  };
  const authorizationField = (key: LockedField, label: string, value: string) => <div className="ycb-authorized-field">
    <label>{label}<input value={value} disabled={lockedFields[key]} onChange={(event) => onChange(key, event.target.value)} /></label>
    <div className="ycb-field-actions">
      {lockedFields[key] ? <button type="button" className="secondary-button" onClick={() => unlock(key)}><UnlockKeyhole size={14} /> Edit</button> : <button type="button" className="secondary-button" onClick={() => saveDefault(key)} disabled={!value.trim()}><Save size={14} /> Save as default</button>}
      {lockedFields[key] && <button type="button" className="text-button" onClick={() => clearDefault(key)}>Clear default</button>}
    </div>
  </div>;
  const print = () => openPrintWindow(html, "Yemen Commercial Bank Official Certificate");

  return <main className="bank-workspace" dir="ltr">
    <div className="bank-workspace-heading"><div><p className="eyebrow">YEMEN COMMERCIAL BANK</p><h2>Official Certificate Issuance</h2><p className="hint">Independent YCB certificate entry. These values are not shared with the AlKuraimi workspace.</p></div><button type="button" className="secondary-button" onClick={onBack}><ArrowRight size={16} /> Select another bank</button></div>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>Customer Information</h2><p className="hint">YCB customer fields only. Momaiz No. is not used by Yemen Commercial Bank.</p></div><FileText size={26} className="heading-icon" /></div><div className="grid">
      <label>Customer name<input value={client.name} onChange={(e) => onChange("name", e.target.value)} /></label>
      <label>Passport No. <span className="field-note">Optional</span><input dir="ltr" value={client.passport} onChange={(e) => onChange("passport", e.target.value)} /></label>
      <label>Branch name<input dir="ltr" value={client.branch} onChange={(e) => onChange("branch", e.target.value)} /></label>
      <label>Customer since<input value={client.customerSince} onChange={(e) => onChange("customerSince", e.target.value)} /></label>
      <label>Date of birth <span className="field-note">Optional</span><input type="date" value={client.dateOfBirth} onChange={(e) => onChange("dateOfBirth", e.target.value)} /></label>
    </div></section>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>Account Information</h2><p className="hint">Fields used by the independent YCB account certificate.</p></div></div><div className="grid">
      <label>Account type<input dir="ltr" value={client.accountType} onChange={(e) => onChange("accountType", e.target.value)} /></label>
      <label>Account number<input dir="ltr" value={client.accountNumber} onChange={(e) => onChange("accountNumber", e.target.value)} /></label>
      <label>Currency<select value={client.currency} onChange={(e) => onChange("currency", e.target.value)}><option>YER</option><option>USD</option><option>SAR</option></select></label>
      <label>Balance<input dir="ltr" value={client.opening} onChange={(e) => onChange("opening", e.target.value)} /></label>
    </div></section>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>Certificate Information</h2><p className="hint">The optional reference is placed in the header when provided. The issue date is used in the English and Arabic date header.</p></div></div><div className="grid">
      <label>Reference number <span className="field-note">Optional</span><input dir="ltr" value={client.referenceNumber} onChange={(e) => onChange("referenceNumber", e.target.value)} /></label>
      <label>Issue date<input value={client.issueDate} onChange={(e) => onChange("issueDate", e.target.value)} /></label>
    </div></section>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>Authorization Information</h2><p className="hint">Save authorized names as independent YCB defaults. You can unlock and change them at any time.</p></div><LockKeyhole size={26} className="heading-icon" /></div><div className="ycb-authorization-grid">
      {authorizationField("customerServiceName", "Customer Service", client.customerServiceName)}
      {authorizationField("branchManagerName", "Branch Manager", client.branchManagerName)}
    </div>{defaultMessage && <p className="hint" role="status">{defaultMessage}</p>}</section>
    <div className="actions"><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "Hide preview" : "Show preview"}</button><button type="button" onClick={print}><Printer size={17} /> Print / Save PDF</button></div>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>Official YCB Certificate Preview</h2><p className="hint">This preview uses the independent official English certificate layout and assets.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Official Yemen Commercial Bank certificate preview" srcDoc={html} /></div></section>}
  </main>;
}

export function BankSelector({ onSelect, onLogout }: { onSelect: (bank: "karimi" | "ycb") => void; onLogout: () => void }) {
  return <main className="bank-selector" dir="rtl"><section className="bank-selector-card"><div className="system-mark"><FileText size={30} /></div><p className="eyebrow">منصة إصدار ومراجعة الكشوف · Statement Workspace</p><h1>اختر مساحة العمل · Select workspace</h1><p className="hint">كل بنك يعمل في مساحة مستقلة، ولن تُخلط بياناته مع البنك الآخر.</p><div className="bank-choice-grid"><button type="button" onClick={() => onSelect("karimi")}><strong>بنك الكريمي <span>AlKuraimi Bank</span></strong><small>نظام الكشوف الحالي · Current statement system</small></button><button type="button" onClick={() => onSelect("ycb")}><strong>بنك اليمن التجاري <span>Yemen Commercial Bank</span></strong><small>البنك التجاري اليمني · القالب الرسمي ومدخلات YCB</small></button></div><section className="bank-data-table-wrap"><h2>فصل البيانات والاستعادة · Data isolation</h2><p className="hint">كل بنك يستعيد Snapshot وHistory والعمليات إلى مساره فقط.</p><table className="bank-data-table"><thead><tr><th>البنك · Bank</th><th>Snapshot</th><th>History</th><th>Excel / العمليات</th><th>الحالة · Status</th></tr></thead><tbody><tr><td><strong>الكريمي · AlKuraimi</strong></td><td>مساحة Karimi</td><td>سجلات Karimi</td><td>محرك الكريمي</td><td>مفعّل · Active</td></tr><tr><td><strong>اليمن التجاري · YCB</strong></td><td>مساحة YCB</td><td>سجلات YCB</td><td>محرك مستقل</td><td>مفعّل · Active</td></tr></tbody></table></section><button type="button" className="secondary-button" onClick={onLogout}>تسجيل الخروج · Sign out</button></section></main>;
}

export default YcbCertificateWorkspace;
