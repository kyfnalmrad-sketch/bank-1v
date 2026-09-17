import { useMemo, useState } from "react";
import { ChevronLeft, FileText, Printer } from "lucide-react";
import { useEffect } from "react";
import QRCode from "qrcode";
import bwipjs from "bwip-js/browser";
import { type YcbStatementProfile, type YcbStatementTransaction } from "@/lib/ycbStatementPreview";
import { renderOriginalYcbStatementPage } from "@/lib/ycbOriginalStatementTemplate";
import { buildYcbStatementBarcodePayload, buildYcbStatementQrPayload } from "@/lib/documentSync";
import { openPrintWindow } from "@/lib/printDocument";

type Props = {
  profile: YcbStatementProfile;
  transactions: YcbStatementTransaction[];
  onBack: () => void;
  onTransactionHighlightChange: (reference: string, color: string) => void;
};

function printHtml(html: string, branch = "") {
  return openPrintWindow(html, "Yemen Commercial Bank — Statement of Account", window, branch);
}

export function renderYcbStatementPages(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], qrSources: string[] = [], barcodeSources: string[] = [], rowHighlights: Record<string, string> = {}) {
  const pageSize = 18;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => transactions.slice(index * pageSize, (index + 1) * pageSize));
  return pages.map((rows, index) => renderOriginalYcbStatementPage({ ...profile, pageNumber: index + 1, pageCount }, rows, index + 1, pageCount, qrSources[index], barcodeSources[index], rowHighlights, {
    totalCredit: rows.reduce((sum, row) => sum + (row.credit || 0), 0),
    totalDebit: rows.reduce((sum, row) => sum + (row.debit || 0), 0),
    closingBalance: rows.at(-1)?.balance ?? profile.closingBalance,
  })).join("<div style='page-break-after:always'></div>");
}
export default function YcbStatementWorkspace({ profile, transactions, onBack, onTransactionHighlightChange }: Props) {
  const [preview, setPreview] = useState(true);
  const [qrSources, setQrSources] = useState<string[]>([]);
  const [barcodeSources, setBarcodeSources] = useState<string[]>([]);
  const rowHighlights = useMemo(() => Object.fromEntries(transactions.filter((row) => row.highlightColor).map((row) => [row.reference, row.highlightColor as string])), [transactions]);
  const pageSize = 18;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const pageGroups = useMemo(() => Array.from({ length: pageCount }, (_, index) => transactions.slice(index * pageSize, (index + 1) * pageSize)), [pageCount, transactions]);
  useEffect(() => {
    let cancelled = false;
    const buildInput = (rows: YcbStatementTransaction[], pageNumber: number) => ({
      customerName: profile.customerName, passport: profile.passport, address: profile.address, accountNumber: profile.accountNumber, branchName: profile.branchName, currency: profile.currency, statementReference: profile.statementReference, pageNumber, pageCount, periodStart: profile.periodStart, periodEnd: profile.periodEnd, issueDate: profile.issueDate,
      firstReference: rows[0]?.reference, lastReference: rows.at(-1)?.reference, transactionCount: rows.length, creditCount: rows.filter((row) => (row.credit || 0) > 0).length, debitCount: rows.filter((row) => (row.debit || 0) > 0).length, totalCredit: rows.reduce((sum, row) => sum + (row.credit || 0), 0), totalDebit: rows.reduce((sum, row) => sum + (row.debit || 0), 0), openingBalance: rows[0] ? rows[0].balance - (rows[0].credit || 0) + (rows[0].debit || 0) : profile.openingBalance, closingBalance: rows.at(-1)?.balance ?? profile.closingBalance,
    });
    Promise.all(pageGroups.map((rows, index) => QRCode.toDataURL(buildYcbStatementQrPayload(buildInput(rows, index + 1)), { width: 520, margin: 4, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } }))).then((sources) => { if (!cancelled) setQrSources(sources); }).catch(() => { if (!cancelled) setQrSources([]); });
    try {
      const generated = pageGroups.map((rows, index) => {
        const svg = bwipjs.toSVG({ bcid: "pdf417", text: buildYcbStatementBarcodePayload(buildInput(rows, index + 1)), scaleX: 2, scaleY: 2, padding: 4, includetext: false, backgroundcolor: "FFFFFF", barcolor: "2D3192" });
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      if (!cancelled) setBarcodeSources(generated);
    } catch { if (!cancelled) setBarcodeSources([]); }
    return () => { cancelled = true; };
  }, [pageGroups, pageCount, profile]);
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "ycb-highlight" || typeof event.data.reference !== "string") return;
      const current = rowHighlights[event.data.reference];
      onTransactionHighlightChange(event.data.reference, current ? "" : "#FEF08A");
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onTransactionHighlightChange, rowHighlights]);
  const html = useMemo(() => renderYcbStatementPages(profile, transactions, qrSources, barcodeSources, rowHighlights), [barcodeSources, profile, qrSources, rowHighlights, transactions]);
  return <main className="bank-workspace" dir="ltr">
    <div className="panel-heading"><div><h1>Yemen Commercial Bank — Statement of Account</h1><p className="hint">هذا القسم مستقل عن الشهادة، ويستخدم نفس بيانات العميل والحركات المدخلة في النظام. لا يحتوي على توقيعات.</p></div><FileText size={28} className="heading-icon" /></div>
    <section className="panel"><div className="review-grid"><div className="validation-card"><span>Customer</span><strong>{profile.customerName || "—"}</strong><small>{profile.accountNumber || "Account number required"}</small></div><div className="validation-card"><span>Period</span><strong>{profile.periodStart} — {profile.periodEnd}</strong><small>{profile.currency} · {profile.branchName || "—"}</small></div><div className="validation-card"><span>Transactions</span><strong>{transactions.length}</strong><small>Linked to the current data-entry register · 18 rows per page</small></div><div className="validation-card"><span>Closing balance</span><strong>{profile.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><small>Calculated from the same register</small></div></div></section>
    <div className="actions"><button type="button" className="secondary-button" onClick={onBack}><ChevronLeft size={16} /> Back to YCB workspace</button><button type="button" onClick={() => setPreview((value) => !value)}><FileText size={17} /> {preview ? "Hide preview" : "Show preview"}</button><button type="button" className="preview-button" onClick={() => printHtml(html, profile.branchName)}><Printer size={17} /> Print / Save PDF</button></div>
    <section className="panel"><div className="panel-heading"><div><h2>تمييز العمليات</h2><p className="hint">اضغط علامة ✓ بجانب الحركة في سجل Excel لتلوينها بالأصفر. ويمكن النقر على صف الحركة في المعاينة لتبديل التمييز.</p></div></div></section>
    {preview && <section className="panel print-preview-panel"><div className="panel-heading"><div><h2>YCB Statement Preview — Approved Template</h2><p className="hint">هذه هي نسخة الكشف المعتمد نفسها. اضغط على أي صف لتلوينه بالأصفر أو إزالة التلوين، ثم اطبع نفس المعاينة بصيغة PDF.</p></div></div><div className="document-frame-wrap"><iframe className="document-frame" title="Yemen Commercial Bank statement preview" srcDoc={html} /></div></section>}
  </main>;
}
