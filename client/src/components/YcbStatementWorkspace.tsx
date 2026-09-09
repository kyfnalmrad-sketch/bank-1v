import { useMemo, useState } from "react";
import { ChevronLeft, FileText, Printer } from "lucide-react";
import { renderYcbDetailedStatementPreview, type YcbStatementProfile, type YcbStatementTransaction } from "@/lib/ycbStatementPreview";

type Props = {
  profile: YcbStatementProfile;
  transactions: YcbStatementTransaction[];
  onBack: () => void;
};

function printHtml(html: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>YCB Statement of Account</title></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}

export function renderYcbStatementPages(profile: YcbStatementProfile, transactions: YcbStatementTransaction[]) {
  const pageSize = 18;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => transactions.slice(index * pageSize, (index + 1) * pageSize));
  const qr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='white'/><path d='M8 8h32v32H8zM80 8h32v32H80zM8 80h32v32H8zM52 52h16v16H52zM80 80h8v8H80zM96 96h16v16H96z' fill='#173d88'/></svg>");
  return pages.map((rows, index) => renderYcbDetailedStatementPreview({ ...profile, pageNumber: index + 1, pageCount }, rows, qr, index + 1, pageCount)).join("<div style='page-break-after:always'></div>");
}

export default function YcbStatementWorkspace({ profile, transactions, onBack }: Props) {
  const [preview, setPreview] = useState(true);
  const html = useMemo(() => renderYcbStatementPages(profile, transactions), [profile, transactions]);
  return <main className="bank-workspace" dir="ltr">
    <div className="panel-heading"><div><h1>Yemen Commercial Bank — Statement of Account</h1><p className="hint">هذا القسم مستقل عن الشهادة، ويستخدم نفس بيانات العميل والحركات المدخلة في النظام. لا يحتوي على توقيعات.</p></div><FileText size={28} className="heading-icon" /></div>
    <section className="panel"><div className="review-grid"><div className="validation-card"><span>Customer</span><strong>{profile.customerName || "—"}</strong><small>{profile.accountNumber || "Account number required"}</small></div><div className="validation-card"><span>Period</span><strong>{profile.periodStart} — {profile.periodEnd}</strong><small>{profile.currency} · {profile.branchName || "—"}</small></div><div className="validation-card"><span>Transactions</span><strong>{transactions.length}</strong><small>Linked to the current data-entry register</small></div><div className="validation-card"><span>Closing balance</span><strong>{profile.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><small>Calculated from the same register</small></div></div></section>
    <div className="actions"><button type="button" className="secondary-button" onClick={onBack}><ChevronLeft size={16} /> Back to YCB workspace</button><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "Hide preview" : "Show preview"}</button><button type="button" className="preview-button" onClick={() => printHtml(html)}><Printer size={17} /> Print / Save PDF</button></div>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>YCB Statement Preview</h2><p className="hint">المعاينة والطباعة من نفس بيانات الواجهة، مع تقسيم تلقائي إلى صفحات.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Yemen Commercial Bank statement preview" srcDoc={`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`} /></div></section>}
  </main>;
}
