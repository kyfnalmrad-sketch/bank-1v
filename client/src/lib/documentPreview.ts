/**
 * Reference previews preserve the Prototype 0.5.1 visual rules while every
 * user-provided field remains HTML escaped before it enters an iframe document.
 */
export const MAX_TRANSACTIONS_PER_PAGE = 18;

export type PreviewTransaction = {
  date: string;
  description: string;
  branch?: string;
  operationNumber: string;
  debit: number;
  credit: number;
  balance: number | null;
};

export type AccountStatusPreviewInput = {
  backgroundUri: string;
  qrUri: string;
  qrLogoUri?: string;
  customerName: string;
  momaizNo: string;
  passport: string;
  dateOfBirth: string;
  customerSince: string;
  accountType: string;
  accountNumber: string;
  branchName: string;
  currency: string;
  issueDate: string;
  issueDateHijri: string;
  printTime: string;
  correspondenceDate: string;
  employeeName?: string;
  managerName?: string;
  opening: number;
  credit: number;
  debit: number;
  closing: number;
  enclosurePages: number;
  referenceNo: string;
};

export type StatementPreviewInput = {
  headerUri: string;
  qrUri: string;
  qrLogoUri?: string;
  customerName: string;
  dateOfBirth?: string;
  accountNumber: string;
  momaizNo: string;
  branchName: string;
  currency: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  statementReference: string;
  includeBranch?: boolean;
  pageNumber: number;
  pageCount: number;
  barcodeUri: string;
  barcodeLabel: string;
  closing: number;
  pageSummary?: {
    debitCount: number;
    creditCount: number;
    totalDebit: number;
    totalCredit: number;
    openingBalance: number;
    firstReference: string;
    lastReference: string;
  };
  transactions: PreviewTransaction[];
};

const escapeHtml = (input: unknown) => String(input ?? "—")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const value = (input: unknown) => escapeHtml(input || "—");
const amount = (input: number | null | undefined) => Number(input ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const balanceAmount = (input: number | null | undefined) => {
  const numeric = Number(input ?? 0);
  return `${amount(Math.abs(numeric))} ${numeric < 0 ? "DR" : "CR"}`;
};

const descriptionClass = (input: string) => Array.from(input).length > 56 ? "description-compact" : "description-standard";

export function renderAccountStatusPreview(data: AccountStatusPreviewInput) {
  const optionalIdentity = [
    data.passport ? `<span><b>Passport Number:</b> ${value(data.passport)}</span>` : "",
    data.dateOfBirth ? `<span><b>Date of Birth:</b> ${value(data.dateOfBirth)}</span>` : "",
    data.customerSince ? `<span><b>Customer Since:</b> ${value(data.customerSince)}</span>` : "",
  ].filter(Boolean).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box}
    html,body{width:210mm;height:297mm;margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111}
    .page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff}
    .background-art{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:1}
    .correspondence{position:absolute;left:13mm;top:68mm;z-index:3;border:.7pt solid #6b5297;background:rgba(255,255,255,.94);padding:1.3mm 2mm;font-size:8.5pt;line-height:1.35}
    .correspondence div{white-space:nowrap}
    .qr-wrap{position:absolute;right:13mm;top:60mm;width:27mm;height:27mm;padding:1mm;background:#fff;z-index:3}
    .qr-wrap img.qr{display:block;width:100%;height:100%;object-fit:contain;image-rendering:crisp-edges;image-rendering:-webkit-optimize-contrast}
    .qr-mark{position:absolute;left:35%;top:35%;width:30%;height:30%;padding:0;border:0;border-radius:0;background:transparent;object-fit:contain;object-position:center;filter:brightness(0) saturate(100%) invert(25%) sepia(92%) saturate(1715%) hue-rotate(199deg) brightness(88%) contrast(96%)}
    .meta{position:absolute;left:12mm;right:12mm;top:87mm;z-index:3;font-size:8.4pt;line-height:1.5}
    .meta strong{color:#6b5297}
    .hijri{position:absolute;left:13mm;right:13mm;top:92.5mm;z-index:3;font:700 8.5pt/1.35 Arial,Tahoma,sans-serif}
    .content{position:absolute;left:13mm;right:13mm;top:101mm;bottom:42mm;padding:4mm;font-size:9.8pt;line-height:1.28;z-index:2;background:rgba(255,255,255,.92);border:.6pt solid rgba(107,82,151,.45)}
    .attestation{font-weight:700;margin:0 0 2.4mm}
    .identity{display:grid;grid-template-columns:1fr 1fr;gap:2px 5mm;margin:0 0 2.2mm;font-size:8.8pt;line-height:3.45mm}
    .identity span{white-space:nowrap;overflow:hidden;text-overflow:clip}
    .identity .full{grid-column:1/-1}
    table{width:100%;border-collapse:collapse;margin:2.5mm 0 3mm;font-size:9.1pt;text-align:center}
    th,td{border:1pt solid #6b5297;padding:1.5mm 1.3mm;vertical-align:middle;font-weight:700}
    th{background:#eeeaf4;color:#111}
    .balance th{width:43%;text-align:left;padding-left:3mm}
    .customer-request-notice{margin:8mm 0 0;padding:2.4mm 2.6mm;border-top:.8pt solid #bcaed1;border-bottom:.8pt solid #bcaed1;background:rgba(255,255,255,.72);font-size:8.6pt;line-height:1.45;font-weight:600;text-align:justify}
    .disclaimer{position:absolute;left:17mm;right:17mm;bottom:20mm;font-size:7.7pt;line-height:1.4;color:#6b1f1f;text-align:center;border-top:.6pt solid #bcaed1;padding-top:2mm;z-index:2}
    .signatures{position:absolute;left:4mm;right:4mm;bottom:10mm;display:grid;grid-template-columns:1fr 1fr;gap:20mm;text-align:center;color:#6b5297;font-size:14pt;line-height:1.35;z-index:3}
    .signatures .role{font-weight:700;font-size:14pt}.signatures .name{font-weight:400;font-size:14pt;min-height:6mm}
    </style></head><body><section class="page">
    <img class="background-art" src="${escapeHtml(data.backgroundUri)}" alt="Original statement background">
    <div class="correspondence"><div><b>Date:</b> ${value(data.correspondenceDate || data.issueDate)}</div>
<div><b>Enclosures:</b> Statement PDF — ${Math.max(1, data.enclosurePages)} page</div></div>
    <div class="qr-wrap"><img class="qr" src="${escapeHtml(data.qrUri)}" alt="Verification QR">${data.qrLogoUri ? `<img class="qr-mark" src="${escapeHtml(data.qrLogoUri)}" alt="Logo">` : ""}</div>
    <div class="meta"><b>Document Date:</b> ${value(data.issueDate)} &nbsp; <b>Print Time:</b> ${value(data.printTime)}</div>
    <div class="hijri" dir="rtl" lang="ar">التاريخ الهجري: ${value(data.issueDateHijri)}</div>
    <main class="content">
      <p class="attestation">This statement reflects the account information recorded by AlKuraimi Islamic Microfinance Bank as of the selected statement date.</p>
      <div class="identity"><span><b>Customer Name:</b> ${value(data.customerName)}</span><span><b>Momaiz No.:</b> ${value(data.momaizNo)}</span>${optionalIdentity}<span class="full"><b>Statement Reference:</b> ${value(data.referenceNo)}</span></div>
      <table><thead><tr><th>Account Type</th><th>Account Number</th><th>Branch Name</th><th>Account Currency</th></tr></thead><tbody><tr><td>${value(data.accountType)}</td><td>${value(data.accountNumber)}</td><td>${value(data.branchName)}</td><td>${value(data.currency)}</td></tr></tbody></table>
      <table class="balance"><thead><tr><th colspan="2">BALANCE SUMMARY</th></tr></thead><tbody><tr><th>Opening Balance</th><td>${amount(data.opening)}</td></tr><tr><th>Total Credits</th><td>${amount(data.credit)}</td></tr><tr><th>Total Debits</th><td>${amount(data.debit)}</td></tr><tr><th>Closing Balance</th><td>${amount(data.closing)}</td></tr></tbody></table>
      <p class="attestation">Issued by AlKuraimi Islamic Microfinance Bank as of the statement date.</p>
      <p class="customer-request-notice">This statement has been issued at the customer’s request. The customer is requested to review the information and notify AlKuraimi Islamic Microfinance Bank of any discrepancy within fifteen (15) calendar days of receipt. After this period, the Bank shall not be responsible for claims arising from unreported discrepancies, subject to applicable law and the account terms and conditions.</p>
      <div class="signatures"><div><div class="role">Customer Service</div><div class="name">${value(data.employeeName)}</div></div><div><div class="role">Branch Manager</div><div class="name">${value(data.managerName)}</div></div></div>
    </main>
    <div class="disclaimer">AlKuraimi Islamic Microfinance Bank</div>
  </section></body></html>`;
}

export function renderStatementPreview(data: StatementPreviewInput) {
  const rows = data.transactions.slice(0, MAX_TRANSACTIONS_PER_PAGE);
  const includeBranch = Boolean(data.includeBranch);
  const tableClass = includeBranch ? "transactions with-branch" : "transactions";
  const headerClass = includeBranch ? "tx-head with-branch" : "tx-head";
  const barcodeFooter = data.barcodeUri
    ? `<div class="side-barcode"><div class="barcode-frame"><img src="${escapeHtml(data.barcodeUri)}" alt="Verification barcode"></div><span>${value(data.barcodeLabel)}</span></div>`
    : "";
  const tableRows = rows.length
    ? rows.map((row) => `<tr data-operation="${escapeHtml(row.operationNumber)}"><td class="date-cell"><span>${value(row.date)}</span></td><td class="particular-cell"><span class="description-line ${descriptionClass(row.description)}">${value(row.description)}</span></td>${includeBranch ? `<td class="branch-cell"><span>${value(row.branch)}</span></td>` : ""}<td class="operation-cell"><span>${value(row.operationNumber)}</span></td><td class="number-cell${row.debit ? "" : " debit-placeholder-cell"}"><span>${row.debit ? `-${amount(row.debit)}` : "-----"}</span></td><td class="credit-cell${row.credit ? "" : " placeholder-cell"}"><span>${row.credit ? amount(row.credit) : "-----"}</span></td><td class="balance-cell"><span>${balanceAmount(row.balance)}</span></td></tr>`).join("")
    : `<tr><td class="date-cell"><span>—</span></td><td class="particular-cell"><span class="description-line description-standard">No imported transactions</span></td>${includeBranch ? `<td class="branch-cell"><span>—</span></td>` : ""}<td class="operation-cell"><span>—</span></td><td class="number-cell debit-placeholder-cell"><span>-----</span></td><td class="credit-cell placeholder-cell"><span>-----</span></td><td class="balance-cell"><span>${balanceAmount(data.closing)}</span></td></tr>`;
  const finalSection = data.pageNumber === data.pageCount
    ? `<section class="end${includeBranch ? " with-branch" : ""}"><div class="end-label">END OF REPORT</div><div class="end-balance-label">BALANCE</div><div class="end-balance-value">${balanceAmount(data.closing)}</div></section><p class="notice">Please review this statement and report any discrepancy to AlKuraimi Islamic Microfinance Bank within fifteen (15) calendar days of receipt.</p>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box}
    html,body{width:210mm;margin:0;background:#fff;font-family:Calibri,Arial,sans-serif;color:#000}
    .page{position:relative;width:210mm;height:297mm;overflow:hidden}
    .masthead{position:relative;width:210mm;height:75mm}
    .header-art{position:absolute;left:2.05mm;top:2.7mm;width:204.52mm;height:48.65mm;object-fit:fill;clip-path:inset(0 0 22% 0);z-index:1}
    .qr-wrap{position:absolute;left:5.8mm;top:5.4mm;width:25mm;height:25mm;padding:1mm;background:#fff;z-index:3}
    .qr-wrap img.qr{display:block;width:100%;height:100%;object-fit:contain;image-rendering:crisp-edges;image-rendering:-webkit-optimize-contrast}
    .qr-mark{position:absolute;left:35%;top:35%;width:30%;height:30%;padding:0;border:0;border-radius:0;background:transparent;object-fit:contain;object-position:center;filter:brightness(0) saturate(100%) invert(25%) sepia(92%) saturate(1715%) hue-rotate(199deg) brightness(88%) contrast(96%)}
    .meta{position:absolute;left:8mm;top:40.2mm;width:194mm;display:grid;grid-template-columns:94mm 85mm;column-gap:10mm;padding:2mm 3mm;border:.6pt solid #6d6d86;border-radius:4mm;background:#fff;z-index:2;font:400 9.6pt/5mm Arial,Tahoma,sans-serif}
    .left-meta{display:grid;grid-template-rows:repeat(3,1fr);align-content:start;gap:1mm;min-width:0;padding-top:0}.left-meta .meta-field{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:3mm;align-items:center;min-height:8mm;line-height:4mm}
    .meta-field{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:3mm;align-items:center;min-height:8mm;line-height:4mm}.meta-field b{display:block}.meta-field .field-value{text-align:left;display:block;line-height:4mm}
    .meta-field .field-value{display:block;min-width:0;overflow-wrap:anywhere;word-break:break-word}
    .meta b{white-space:nowrap}
    .right-meta{display:grid;grid-template-rows:repeat(3,1fr);align-content:start;gap:1mm;padding-top:0}.right-meta .meta-row{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:2.5mm;align-items:center;min-height:8mm;line-height:4mm;overflow:hidden}.right-meta .meta-row b{display:block}.right-meta .meta-value{text-align:left;display:block;line-height:4mm}
    .right-meta .branch-row{grid-template-columns:max-content minmax(0,1fr)}
    .right-meta .date-row{grid-template-columns:max-content minmax(0,1fr)}
    .right-meta .meta-value{display:block;min-width:0;max-width:100%;max-height:5mm;line-height:4mm;white-space:nowrap;overflow:hidden;text-overflow:clip}
    .right-meta .branch-row .meta-value{font-size:8.5pt;letter-spacing:-.08pt}
    .page-strip{position:absolute;left:55mm;right:8mm;bottom:5mm;height:10.5mm;border:.45pt solid #6b5297;border-radius:1.5mm;background:#fff;color:#3f2b68;overflow:hidden;font:700 5.7pt/2.8mm Arial,Tahoma,sans-serif;z-index:4}.side-barcode{position:absolute;left:8mm;bottom:5.2mm;width:43mm;height:11.5mm;padding:1.2mm 1.5mm .8mm;border:1pt solid #6b5297;border-radius:1.5mm;background:#fff;color:#6b5297;display:grid;grid-template-rows:7.3mm 2mm;gap:.4mm;text-align:center;font:700 5.2pt/5.4pt Arial,Tahoma,sans-serif;letter-spacing:.02em;z-index:4}.barcode-frame{width:40mm;height:7.3mm;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center}.barcode-frame img{display:block;width:40mm;height:7.3mm;object-fit:fill;object-position:center;background:#fff}
    .page-strip table{width:100%;height:100%;margin:0;border-collapse:collapse;table-layout:fixed}.page-strip tr:first-child{background:#eeeaf4;color:#3f2b68}.page-strip tr:last-child{background:#fff}.page-strip td{border-top:.35pt solid #c8bdd8}
    .page-strip td{padding:.45mm .7mm;border-left:.35pt solid #c8bdd8;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:clip;font-weight:700}
    .page-strip td:first-child{border-left:0}
    .tx-head,.transactions{table-layout:fixed;border-collapse:collapse;width:190mm;margin-left:10mm}.tx-head{margin-top:2mm}
    .tx-head{height:9.91mm}
    .tx-head tr,.transactions tr{display:grid;width:190mm;grid-template-columns:26.5mm 56mm 27mm 20mm 22mm 38.5mm}
    .tx-head.with-branch tr,.transactions.with-branch tr{grid-template-columns:21.5mm 62mm 24mm 23mm 18mm 19mm 22.5mm}
    .tx-head th{height:9.91mm;padding:0 1mm;border:1.44pt solid #767171;background:#e7e6e6;font:700 10.3pt/10.3pt Arial,sans-serif;text-align:center;vertical-align:middle;display:flex;align-items:center;justify-content:center;min-width:0;line-height:1.1}
    .transactions tr{break-inside:avoid;page-break-inside:avoid;min-height:9.3mm}
    .transactions td{min-width:0;min-height:9.3mm;padding:.7mm .45mm;border:0;text-align:center;vertical-align:middle;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .transactions tr:nth-child(even) td{background:#e7e6e6}
    .date-cell{text-align:center;white-space:nowrap;font:400 10.5pt/10.5pt Calibri,Arial,sans-serif}
    .particular-cell{overflow:hidden;white-space:normal;text-align:left!important;font:700 8.05pt/2.85mm Arial,Tahoma,sans-serif;padding:.65mm 1.1mm!important;align-items:flex-start!important;justify-content:flex-start!important}
    .branch-cell{font:400 8pt/3.2mm Arial,Tahoma,sans-serif;white-space:normal;overflow-wrap:anywhere}
    .operation-cell{font:400 7.6pt/8pt Arial,Tahoma,sans-serif;white-space:nowrap;color:#6b5297}
    .number-cell{white-space:nowrap;font:400 9.2pt/9.2pt "Courier New",Courier,monospace}
    .credit-cell{white-space:nowrap;font:700 9.2pt/9.2pt Calibri,Arial,sans-serif}
    .balance-cell{white-space:nowrap;overflow:visible!important;font:400 10.2pt/10.2pt Calibri,Arial,sans-serif}
    .transactions td span{display:block;overflow:hidden;text-overflow:clip}
    .particular-cell .description-line{display:-webkit-box;color:#000;white-space:normal;overflow:hidden;overflow-wrap:anywhere;word-break:break-word;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    .particular-cell .description-standard{font:700 8.05pt/2.85mm Arial,Tahoma,sans-serif;max-height:5.7mm}
    .particular-cell .description-compact{font:700 7.55pt/2.8mm Arial,Tahoma,sans-serif;max-height:5.6mm}
    .date-cell span{transform:translate(2.1pt,-2.73pt)}
    .particular-cell span{transform:translateX(1.61pt)}
    .number-cell span{transform:translate(1.88pt,-1.59pt)}
    .debit-placeholder-cell span{transform:translate(-1.09pt,-1.59pt)}
    .credit-cell span{transform:translate(2.07pt,-2.73pt)}
    .credit-cell.placeholder-cell span{transform:translate(-1.13pt,-1.59pt)}
    .balance-cell span{transform:translate(2.03pt,-.69pt)}
    .notice{width:190mm;min-height:7.2mm;margin:2.4mm 0 0 10mm;padding:0 1mm;color:#b00020;text-align:center;font:700 8.1pt/3.2mm Arial,sans-serif}
    .end{width:190mm;margin-left:10mm;padding-bottom:2.2mm;border-bottom:3pt solid #002060;display:grid;grid-template-columns:26.5mm 56mm 27mm 20mm 22mm 38.5mm;color:#002060;text-align:center}.end.with-branch{grid-template-columns:21.5mm 62mm 24mm 23mm 18mm 19mm 22.5mm}.end-label{grid-column:1 / span 4}.end.with-branch .end-label{grid-column:1 / span 5}.end-balance-label,.end-balance-value{align-self:center}
    .end div{padding-top:.44mm;font:700 10.5pt/10.5pt "Times New Roman",serif}
  </style></head><body><section class="page">
    <header class="masthead">
      <img class="header-art" src="${escapeHtml(data.headerUri)}" alt="Original statement header">
      <div class="qr-wrap"><img class="qr" src="${escapeHtml(data.qrUri)}" alt="Verification QR">${data.qrLogoUri ? `<img class="qr-mark" src="${escapeHtml(data.qrLogoUri)}" alt="Logo">` : ""}</div>
      <div class="meta">
        <div class="left-meta"><div class="meta-field"><b>Customer Name:</b><span class="field-value">${value(data.customerName)}${data.dateOfBirth ? `<br><b>Date of Birth:</b> ${value(data.dateOfBirth)}` : ""}</span></div><div class="meta-field"><b>Account Number:</b><span class="field-value">${value(data.accountNumber)}</span></div><div class="meta-field"><b>Momaiz No.:</b><span class="field-value">${value(data.momaizNo)}</span></div></div>
        <div class="right-meta"><div class="meta-row branch-row"><b>Branch Name:</b><span class="meta-value">${value(data.branchName)}</span></div><div class="meta-row"><b>Account Currency:</b><span class="meta-value">${value(data.currency)}</span></div><div class="meta-row date-row"><b>Date:</b><span class="meta-value">${value(data.issueDate)}</span></div></div>
      </div>
    </header>
    <table class="${headerClass}"><thead><tr><th>Date</th><th>Movement Description</th>${includeBranch ? "<th>Branch</th>" : ""}<th>Ref No.</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead></table>
    <table class="${tableClass}"><tbody>${tableRows}</tbody></table>
    ${finalSection}${barcodeFooter}${data.pageSummary ? `<div class="page-strip" dir="rtl"><table><tbody><tr><td>صفحة ${data.pageNumber}/${data.pageCount}</td><td>${rows.length} عملية</td><td>سحب ${data.pageSummary.debitCount} · ${amount(data.pageSummary.totalDebit)}</td><td>إيداع ${data.pageSummary.creditCount} · ${amount(data.pageSummary.totalCredit)}</td></tr><tr><td>بداية ${amount(data.pageSummary.openingBalance)}</td><td>نهاية ${amount(data.closing)}</td><td>مرجع أول ${value(data.pageSummary.firstReference)}</td><td>مرجع آخر ${value(data.pageSummary.lastReference)}</td></tr></tbody></table></div>` : ""}
  </section></body></html>`;
}
