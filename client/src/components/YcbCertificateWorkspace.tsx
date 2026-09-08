import React, { useMemo, useState } from "react";
import { ArrowRight, FileText, Printer } from "lucide-react";
import { openPrintWindow } from "@/lib/printDocument";

type YcbClient = {
  name: string;
  branch: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  opening: string;
  issueDate: string;
};

type Props = {
  client: YcbClient;
  onChange: (key: keyof YcbClient, value: string) => void;
  onBack: () => void;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function certificateHtml(client: YcbClient) {
  const field = (value: unknown) => `<span class="field">${escapeHtml(value || "[غير محدد]")}</span>`;
  const balance = client.opening || "0.00";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Yemen Commercial Bank Certificate</title>
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eef5;color:#162b48;font-family:Arial,Tahoma,sans-serif}.sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:18mm 19mm 24mm;background:#fff;overflow:hidden}.sheet:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(27,111,155,.08),transparent 32%),radial-gradient(circle at 90% 12%,rgba(38,165,179,.12),transparent 28%);pointer-events:none}.content{position:relative;z-index:1}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1c7096;padding-bottom:7mm}.brand{display:flex;align-items:center;gap:4mm}.mark{width:21mm;height:21mm;border-radius:5mm;background:linear-gradient(145deg,#123b5d,#238ea0);color:#fff;display:grid;place-items:center;font-size:18px;font-weight:800}.brand-en{font-size:15px;font-weight:800;line-height:1.35}.brand-en small{font-size:9px;color:#64748b;font-weight:400}.brand-ar{font-size:17px;font-weight:800;text-align:right;color:#123b5d}.meta{margin-top:3mm;font-size:9.5px;color:#51657c;line-height:1.65;text-align:right}.eyebrow{text-align:center;letter-spacing:2px;color:#1d7899;font-size:11px;font-weight:700;margin-top:18mm}h1{text-align:center;font-family:Georgia,serif;font-size:25px;margin:4mm 0 2mm;color:#123b5d}.title-ar{text-align:center;font-size:18px;font-weight:700;margin-bottom:8mm;color:#123b5d}.rule{width:56mm;height:3px;margin:0 auto 9mm;background:linear-gradient(90deg,#33aeb8,#123b5d);border-radius:3px}.salutation{text-align:center;font-family:Georgia,serif;font-weight:700;font-size:17px;margin-bottom:7mm}.letter{font-family:Georgia,Arial,sans-serif;font-size:15px;line-height:2.05;text-align:justify}.field{color:#123b5d;font-weight:700;border-bottom:1px dotted #2b82a3;padding:0 5px;white-space:nowrap}.summary{margin:9mm 0;border:1px solid #d5e0eb;border-right:5px solid #237e9e;background:#f7faff;padding:5mm 7mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm 12mm}.summary div{border-bottom:1px solid #e5ebf3;padding-bottom:3mm}.summary small{display:block;color:#64748b;font-size:10px;margin-bottom:1.5mm}.summary strong{color:#123b5d;font-size:15px}.notice{background:#f5fbfd;border:1px solid #cfeaf1;border-radius:4px;padding:5mm 6mm;font-family:Georgia,serif;font-size:12px;line-height:1.8}.signatures{margin-top:16mm;display:grid;grid-template-columns:1fr 1fr;gap:24mm}.signature{padding-top:9mm;border-top:1px solid #123b5d;text-align:center;color:#123b5d;font-size:12px}.signature span{display:block;color:#64748b;font-size:10px;margin-top:2mm}footer{position:absolute;z-index:1;right:19mm;left:19mm;bottom:12mm;border-top:1px solid #d5e0eb;padding-top:4mm;display:flex;justify-content:space-between;color:#64748b;font-size:9px}.accent{color:#1d7899;font-weight:700}@media print{body{background:#fff}.sheet{margin:0}}
</style></head><body><section class="sheet"><div class="content"><header><div class="brand"><div class="mark">YCB</div><div class="brand-en">Yemen Commercial Bank<br><small>Official Banking Document</small></div></div><div><div class="brand-ar">البنك التجاري اليمني</div><div class="meta"><b>Reference:</b> YCB-${escapeHtml(client.accountNumber || "PENDING")}<br><b>Issue date:</b> ${escapeHtml(client.issueDate || "PENDING")}</div></div></header><main><div class="eyebrow">BANK CERTIFICATE</div><h1>TO WHOM IT MAY CONCERN</h1><div class="title-ar">شهادة بنكية</div><div class="rule"></div><div class="salutation">Dear Sir / Madam,</div><div class="letter">We, <span class="field">Yemen Commercial Bank</span>, hereby confirm that our client ${field(client.name)} holds a ${field(client.accountType)} account with us under account number ${field(client.accountNumber)}, maintained at ${field(client.branch)}.<br><br>As of ${field(client.issueDate)}, the available account balance is ${field(balance)} (${field(client.currency)} ${field(balance)}).</div><section class="summary"><div><small>Customer name</small><strong>${escapeHtml(client.name || "غير محدد")}</strong></div><div><small>Account type</small><strong>${escapeHtml(client.accountType || "غير محدد")}</strong></div><div><small>Account number</small><strong>${escapeHtml(client.accountNumber || "غير محدد")}</strong></div><div><small>Currency</small><strong>${escapeHtml(client.currency || "غير محدد")}</strong></div><div><small>Issue date</small><strong>${escapeHtml(client.issueDate || "غير محدد")}</strong></div><div><small>Closing balance</small><strong>${escapeHtml(client.currency)} ${escapeHtml(balance)}</strong></div></section><div class="notice">This certificate is issued upon the request of the customer for the stated purpose. The information is valid as of the issue date and is subject to the bank’s applicable verification and disclosure policies.</div><div class="signatures"><div class="signature">Authorized signature<span>Customer Service / Authorized Officer</span></div><div class="signature">Authorized signature<span>Branch / Operations Manager</span></div></div></main></div><footer><span class="accent">Yemen Commercial Bank</span><span>Official document • ${escapeHtml(client.branch || "Branch")} • Independent staging edition</span></footer></section></body></html>`;
}

export function YcbCertificateWorkspace({ client, onChange, onBack }: Props) {
  const [preview, setPreview] = useState(true);
  const html = useMemo(() => certificateHtml(client), [client]);
  const print = () => openPrintWindow(html, "Yemen Commercial Bank Certificate");
  return <main className="bank-workspace" dir="rtl">
    <div className="bank-workspace-heading"><div><p className="eyebrow">YEMEN COMMERCIAL BANK</p><h2>شهادة بنك اليمن التجاري</h2><p className="hint">مساحة مستقلة عن نظام بنك الكريمي — نفس بيانات العميل قابلة للتحرير والمعاينة والطباعة.</p></div><button type="button" className="secondary-button" onClick={onBack}><ArrowRight size={16} /> اختيار بنك آخر</button></div>
    <section className="panel bank-form-panel"><div className="panel-heading"><div><h2>بيانات الشهادة</h2><p className="hint">لا يتم تغيير نموذج الكريمي أو بياناته من هذه المساحة.</p></div><FileText size={26} className="heading-icon" /></div><div className="grid two-columns">
      <label>اسم العميل<input value={client.name} onChange={(e) => onChange("name", e.target.value)} /></label>
      <label>الفرع<input value={client.branch} onChange={(e) => onChange("branch", e.target.value)} /></label>
      <label>رقم الحساب<input value={client.accountNumber} onChange={(e) => onChange("accountNumber", e.target.value)} /></label>
      <label>نوع الحساب<input value={client.accountType} onChange={(e) => onChange("accountType", e.target.value)} /></label>
      <label>العملة<input value={client.currency} onChange={(e) => onChange("currency", e.target.value)} /></label>
      <label>الرصيد<input value={client.opening} onChange={(e) => onChange("opening", e.target.value)} /></label>
      <label>تاريخ الإصدار<input value={client.issueDate} onChange={(e) => onChange("issueDate", e.target.value)} /></label>
    </div><div className="actions"><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "إخفاء المعاينة" : "عرض المعاينة"}</button><button type="button" onClick={print}><Printer size={17} /> طباعة / حفظ PDF</button></div></section>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>معاينة شهادة بنك اليمن التجاري</h2><p className="hint">المعاينة تتحدث تلقائياً مع تغييرات الحقول.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Yemen Commercial Bank certificate preview" srcDoc={html} /></div></section>}
  </main>;
}

export function BankSelector({ onSelect, onLogout }: { onSelect: (bank: "karimi" | "ycb") => void; onLogout: () => void }) {
  return <main className="bank-selector" dir="rtl"><section className="bank-selector-card"><div className="system-mark"><FileText size={30} /></div><p className="eyebrow">منصة إصدار ومراجعة الكشوف</p><h1>اختر البنك</h1><p className="hint">كل مساحة مستقلة، مع الحفاظ على نفس نمط الإدخال والمعاينة والطباعة.</p><div className="bank-choice-grid"><button type="button" onClick={() => onSelect("karimi")}><strong>بنك الكريمي</strong><span>نظام الكشوف الحالي</span></button><button type="button" onClick={() => onSelect("ycb")}><strong>بنك اليمن التجاري</strong><span>نفس محرك الكشوف مع بيانات مستقلة</span></button></div><section className="bank-data-table-wrap"><h2>فصل البيانات والاستعادة</h2><p className="hint">كل بنك يستعيد Snapshot وHistory والعمليات إلى مساره فقط.</p><table className="bank-data-table"><thead><tr><th>البنك</th><th>Snapshot</th><th>History</th><th>Excel / العمليات</th><th>رقم المراجعة</th></tr></thead><tbody><tr><td><strong>الكريمي</strong></td><td>مساحة Karimi</td><td>سجلات Karimi</td><td>محرك الكريمي</td><td>خاص بالكريمي</td></tr><tr><td><strong>اليمن التجاري</strong></td><td>مساحة YCB</td><td>سجلات YCB</td><td>نفس المحرك / مستقل</td><td>خاص بـ YCB</td></tr></tbody></table></section><button type="button" className="secondary-button" onClick={onLogout}>تسجيل الخروج</button></section></main>;
}

export default YcbCertificateWorkspace;
