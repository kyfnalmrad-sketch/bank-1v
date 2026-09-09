/**
 * Yemen Commercial Bank statement templates.
 * Reuses the statement workflow shape without sharing Kuraimi data, references,
 * QR payloads, branding, or statement numbering.
 */

export type YcbStatementTransaction = {
  date: string;
  reference: string;
  description: string;
  credit?: number;
  debit?: number;
  balance: number;
};

export type YcbStatementProfile = {
  customerName: string;
  address: string;
  branchName: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  statementReference: string;
  openingBalance: number;
  closingBalance: number;
  totalCredit: number;
  totalDebit: number;
  issueDate: string;
  pageNumber?: number;
  pageCount?: number;
};

const esc = (value: unknown) => String(value ?? "—")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const money = (value: number | undefined) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const header = (profile: YcbStatementProfile, title: string, qrUri: string) => `
  <header class="masthead">
    <img class="letterhead" src="${title === "Statement of Account" ? "/assets/ycb-detailed-letterhead.png" : "/assets/ycb-official-letterhead.png"}" alt="Yemen Commercial Bank official letterhead">
    ${title === "Statement of Account" ? "" : `<img class="qr" src="${esc(qrUri)}" alt="YCB statement verification">`}
    <div class="meta"><div><b>Statement Reference:</b> ${esc(profile.statementReference)}</div><div><b>Issue Date:</b> ${esc(profile.issueDate)}</div></div>
    <div class="title"><span class="title-en">${title}</span><span class="title-sub">Yemen Commercial Bank</span></div>
  </header>`;

const profileBlock = (profile: YcbStatementProfile) => `<section class="profile">
  <div><b>Customer Name</b><span>${esc(profile.customerName)}</span></div>
  <div><b>Address</b><span>${esc(profile.address)}</span></div>
  <div><b>Branch Name</b><span>${esc(profile.branchName)}</span></div>
  <div><b>Account Number</b><span>${esc(profile.accountNumber)}</span></div>
  <div><b>Account Type</b><span>${esc(profile.accountType)}</span></div>
  <div><b>Currency</b><span>${esc(profile.currency)}</span></div>
  <div><b>The Period</b><span>${esc(profile.periodStart)} — ${esc(profile.periodEnd)}</span></div>
</section>`;

const summaryBlock = (profile: YcbStatementProfile) => `<section class="summary">
  <div><b>Opening Balance</b><strong>${money(profile.openingBalance)}</strong></div>
  <div><b>Total Credit</b><strong>${money(profile.totalCredit)}</strong></div>
  <div><b>Total Debit</b><strong>${money(profile.totalDebit)}</strong></div>
  <div><b>Closing Balance</b><strong>${money(profile.closingBalance)}</strong></div>
</section>`;

const statementTable = (transactions: YcbStatementTransaction[]) => `<table class="statement-table">
  <thead><tr><th>Date</th><th>Reference</th><th>Transaction Description</th><th>Credit</th><th>Debit</th><th>Balance</th></tr></thead>
  <tbody>${transactions.length ? transactions.map((row) => `<tr><td>${esc(row.date)}</td><td>${esc(row.reference)}</td><td class="description">${esc(row.description)}</td><td>${row.credit ? money(row.credit) : "—"}</td><td>${row.debit ? money(row.debit) : "—"}</td><td>${money(row.balance)}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">No transactions entered</td></tr>`}</tbody>
</table>`;

const styles = (mode: "quick" | "detailed") => `<style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#eef3f8;font-family:Arial,Calibri,sans-serif;color:#152a5d}.page{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff;overflow:hidden}.detailed .masthead{height:48mm}.detailed .title{top:27mm}.detailed .meta{top:39mm;right:15mm}.masthead{position:static;height:62mm}.letterhead{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0}.qr{position:absolute;left:7mm;top:3mm;width:22mm;height:22mm;z-index:2;object-fit:contain;image-rendering:crisp-edges}.meta{position:absolute;right:18mm;top:45mm;z-index:2;text-align:right;font-size:9pt;line-height:1.6;color:#172a63}.title{position:absolute;left:20mm;right:20mm;top:50mm;z-index:2;text-align:center;color:#172a63}.title-en{display:block;font-size:${mode === "quick" ? "19pt" : "18pt"};font-weight:700;text-transform:uppercase}.title-sub{display:block;margin-top:1mm;font-size:10pt;color:#2b72a8}.profile{position:relative;z-index:1;margin:0 15mm;padding:4mm 5mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm 8mm;border-top:3px solid #1c3f88;border-bottom:1px solid #b7ccdf;background:#f8fbfd}.profile div{display:flex;gap:3mm;min-width:0;font-size:9pt}.profile b{color:#1c3f88;white-space:nowrap}.profile span{color:#162033;overflow-wrap:anywhere}.summary{position:relative;z-index:1;margin:5mm 15mm 4mm;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #aac1d7;background:#f6fbff}.summary div{padding:3mm 2mm;text-align:center;border-left:1px solid #c6d7e5}.summary div:first-child{border-left:0}.summary b{display:block;font-size:8pt;color:#1c3f88}.summary strong{display:block;margin-top:1mm;font:700 12pt Georgia,serif;color:#162033}.statement-table{position:relative;z-index:1;width:calc(100% - 30mm);margin:0 15mm;border-collapse:collapse;table-layout:fixed;font-size:${mode === "quick" ? "8.7pt" : "8.4pt"}.statement-table th{background:#1c3f88;color:#fff;padding:2.7mm 1.4mm;border:1px solid #16346f;font-weight:700}.statement-table td{padding:2.4mm 1.3mm;border:1px solid #d0dce7;text-align:center;vertical-align:middle;color:#172033}.statement-table tr:nth-child(even) td{background:#f1f7fb}.statement-table .description{text-align:left;font-weight:600}.statement-table .empty{height:25mm;color:#65758c}.statement-table th:nth-child(1){width:15%}.statement-table th:nth-child(2){width:17%}.statement-table th:nth-child(3){width:32%}.statement-table th:nth-child(4),.statement-table th:nth-child(5){width:12%}.statement-table th:nth-child(6){width:12%}.notes{position:relative;z-index:1;margin:5mm 15mm 0;padding:3mm 4mm;border-top:1px solid #a6bfd4;color:#8e1717;font-size:8.5pt;line-height:1.5}.footer{position:absolute;z-index:2;bottom:8mm;left:15mm;right:15mm;text-align:center;color:#1c3f88;font-size:8pt;border-top:1px solid #cbd9e6;padding-top:2mm}.quick-highlight{margin:5mm 15mm 0;padding:4mm;border-left:5px solid #2b9fc4;background:#edf9fc;font-size:9pt;line-height:1.5}.page-number{position:absolute;right:15mm;bottom:18mm;font-size:8pt;color:#1c3f88}.page-break{page-break-after:always}@media print{body{background:#fff}.page{margin:0}}
</style>`;

export function renderYcbQuickStatementPreview(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], qrUri: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>YCB Quick Statement</title>${styles("quick")}</head><body><section class="page quick">${header(profile, "Quick Statement Review", qrUri)}${profileBlock(profile)}${summaryBlock(profile)}<div class="quick-highlight"><b>Quick review:</b> This summary presents the account activity and closing position for the selected period.</div>${statementTable(transactions.slice(0, 10))}<div class="notes"><b>Note:</b> This quick statement is generated from the entered YCB account data and should be reviewed before issuance.</div><div class="footer">Yemen Commercial Bank · Independent YCB statement reference: ${esc(profile.statementReference)}</div></section></body></html>`;
}

export function renderYcbDetailedStatementPreview(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], qrUri: string, pageNumber = 1, pageCount = 1) {
  const pageProfile = { ...profile, pageNumber, pageCount };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>YCB Statement of Account</title>${styles("detailed")}</head><body><section class="page detailed">${header(pageProfile, "Statement of Account", qrUri)}${profileBlock(pageProfile)}${summaryBlock(pageProfile)}${statementTable(transactions)}<div class="notes"><b>Note:</b> The last balance shown represents the account balance as of the statement end date. Please report any discrepancy within the bank’s applicable review period.</div><div class="footer">Yemen Commercial Bank · Page ${pageNumber} of ${pageCount} · Independent YCB reference: ${esc(profile.statementReference)}</div><div class="page-number">Page ${pageNumber} of ${pageCount}</div></section></body></html>`;
}
