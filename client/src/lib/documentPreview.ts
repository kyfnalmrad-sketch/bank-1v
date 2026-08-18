/**
 * Reference previews preserve the Prototype 0.5.1 visual rules while every
 * user-provided field remains HTML escaped before it enters an iframe document.
 */
export type PreviewTransaction = {
  date: string;
  description: string;
  operationNumber: string;
  debit: number;
  credit: number;
  balance: number | null;
};

export type AccountStatusPreviewInput = {
  backgroundUri: string;
  qrUri: string;
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
  customerName: string;
  accountNumber: string;
  momaizNo: string;
  branchName: string;
  currency: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  statementReference: string;
  pageNumber: number;
  pageCount: number;
  barcodeUri: string;
  barcodeLabel: string;
  closing: number;
  transactions: PreviewTransaction[];
};

const escapeHtml = (value: unknown) => String(value ?? "—")
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

export function renderAccountStatusPreview(data: AccountStatusPreviewInput) {
  const optionalIdentity = [
    data.passport ? `<span><b>Passport Number:</b> ${value(data.passport)}</span>` : "",
    data.dateOfBirth ? `<span><b>Date of Birth:</b> ${value(data.dateOfBirth)}</span>` : "",
    data.customerSince ? `<span><b>Customer Since:</b> ${value(data.customerSince)}</span>` : "",
  ].filter(Boolean).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{width:210mm;height:297mm;margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111}.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff url('${escapeHtml(data.backgroundUri)}') center/100% 100% no-repeat}.correspondence{position:absolute;left:13mm;top:68mm;z-index:3;border:.7pt solid #6b5297;background:rgba(255,255,255,.94);padding:1.3mm 2mm;font-size:8.5pt;line-height:1.35}.correspondence div{white-space:nowrap}.qr{position:absolute;right:13mm;top:60mm;width:27mm;height:27mm;object-fit:contain;background:#fff;z-index:3}.meta{position:absolute;left:12mm;right:12mm;top:87mm;z-index:3;font-size:8.4pt;line-height:1.5}.meta strong{color:#6b5297}.hijri{position:absolute;left:13mm;right:13mm;top:92.5mm;z-index:3;font:700 8.5pt/1.35 Arial,Tahoma,sans-serif}.content{position:absolute;left:13mm;right:13mm;top:101mm;bottom:42mm;padding:4mm;font-size:9.8pt;line-height:1.28;z-index:2;background:rgba(255,255,255,.92);border:.6pt solid rgba(107,82,151,.45)}.attestation{font-weight:700;margin:0 0 2.4mm}.identity{display:grid;grid-template-columns:1fr 1fr;gap:2px 5mm;margin:0 0 2.2mm;font-size:8.8pt;line-height:3.45mm}.identity span{white-space:nowrap;overflow:hidden;text-overflow:clip}.identity .full{grid-column:1/-1}table{width:100%;border-collapse:collapse;margin:2.5mm 0 3mm;font-size:9.1pt;text-align:center}th,td{border:1pt solid #6b5297;padding:1.5mm 1.3mm;vertical-align:middle}th{font-weight:700;background:#eeeaf4;color:#111}td{font-weight:600}.balance th{width:43%;text-align:left;padding-left:3mm}.customer-request-notice{margin:8mm 0 0;padding:2.4mm 2.6mm;border-top:.8pt solid #bcaed1;border-bottom:.8pt solid #bcaed1;background:rgba(255,255,255,.72);font-size:8.6pt;line-height:1.45;font-weight:600;text-align:justify}.disclaimer{position:absolute;left:17mm;right:17mm;bottom:20mm;font-size:7.7pt;line-height:1.4;color:#6b1f1f;text-align:center;border-top:.6pt solid #bcaed1;padding-top:2mm;z-index:2}</style></head><body><section class="page"><div class="correspondence"><div><b>Date:</b> ${value(data.correspondenceDate || data.issueDate)}</div><div><b>Enclosures:</b> Statement PDF — ${Math.max(1, data.enclosurePages)} page</div></div><img class="qr" src="${escapeHtml(data.qrUri)}" alt="Verification QR"><div class="meta"><b>Document Date:</b> ${value(data.issueDate)} &nbsp; <b>Print Time:</b> ${value(data.printTime)}</div><div class="hijri" dir="rtl" lang="ar">التاريخ الهجري: ${value(data.issueDateHijri)}</div><main class="content"><p class="attestation">This statement reflects the account information recorded by AlKuraimi Islamic Microfinance Bank as of the selected statement date.</p><div class="identity"><span><b>Customer Name:</b> ${value(data.customerName)}</span><span><b>Momaiz No.:</b> ${value(data.momaizNo)}</span>${optionalIdentity}<span class="full"><b>Statement Reference:</b> ${value(data.referenceNo)}</span></div><table><thead><tr><th>Account Type</th><th>Account Number</th><th>Branch Name</th><th>Account Currency</th></tr></thead><tbody><tr><td>${value(data.accountType)}</td><td>${value(data.accountNumber)}</td><td>${value(data.branchName)}</td><td>${value(data.currency)}</td></tr></tbody></table><table class="balance"><thead><tr><th colspan="2">BALANCE SUMMARY</th></tr></thead><tbody><tr><th>Opening Balance</th><td>${amount(data.opening)}</td></tr><tr><th>Total Credits</th><td>${amount(data.credit)}</td></tr><tr><th>Total Debits</th><td>${amount(data.debit)}</td></tr><tr><th>Closing Balance</th><td>${amount(data.closing)}</td></tr></tbody></table><p class="attestation">Issued by AlKuraimi Islamic Microfinance Bank as of the statement date.</p><p class="customer-request-notice">This statement has been issued at the customer’s request. The customer is requested to review the information and notify AlKuraimi Islamic Microfinance Bank of any discrepancy within fifteen (15) calendar days of receipt. After this period, the Bank shall not be responsible for claims arising from unreported discrepancies, subject to applicable law and the account terms and conditions.</p></main><div class="disclaimer">AlKuraimi Islamic Microfinance Bank</div></section></body></html>`;
}

export function renderStatementPreview(data: StatementPreviewInput) {
  const rows = data.transactions.slice(0, 20);
  const barcodeFooter = data.barcodeUri
    ? `<div class="side-barcode" style="position:absolute;left:5.8mm;bottom:5.2mm;width:56mm;height:9.2mm;display:grid;grid-template-rows:6.8mm 2mm;gap:.4mm;text-align:center;color:#6b5297;font:700 5.2pt/5.4pt Arial,Tahoma,sans-serif;letter-spacing:.02em"><img src="${escapeHtml(data.barcodeUri)}" alt="Verification barcode" style="display:block;width:56mm;height:6.8mm;object-fit:fill;background:#fff"><span>${value(data.barcodeLabel)}</span></div>`
    : "";
  const tableRows = rows.length
    ? rows.map((row) => `<tr data-operation="${escapeHtml(row.operationNumber)}"><td>${value(row.date)}</td><td class="description">${value(row.description)}</td><td>${value(row.operationNumber)}</td><td>${row.debit ? `-${amount(row.debit)}` : "-----"}</td><td>${row.credit ? amount(row.credit) : "-----"}</td><td>${balanceAmount(row.balance)}</td></tr>`).join("")
    : `<tr><td>—</td><td class="description">No imported transactions</td><td>—</td><td>-----</td><td>-----</td><td>${balanceAmount(data.closing)}</td></tr>`;
  const documentHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{width:210mm;margin:0;background:#fff;font-family:Calibri,Arial,sans-serif;color:#000}.page{position:relative;width:210mm;height:297mm;overflow:hidden}.masthead{position:relative;width:210mm;height:51.4mm}.header-art{position:absolute;left:2.05mm;top:2.7mm;width:204.52mm;height:48.65mm;object-fit:fill}.qr{position:absolute;left:5.8mm;top:5.4mm;width:23mm;height:23mm;object-fit:contain;background:#fff}.meta{position:absolute;left:10.2mm;top:28.75mm;width:187.8mm;display:grid;grid-template-columns:86mm 1fr;column-gap:32mm;font:400 9.8pt/3.5mm Arial,Tahoma,sans-serif}.meta div{min-height:7.5mm}.meta b{white-space:nowrap}.tx-head,.transactions{table-layout:fixed;border-collapse:collapse}.tx-head{width:176.11mm;height:9.91mm;margin-left:17.1mm}.tx-head th{height:9.91mm;padding:0 1mm;border:1.44pt solid #767171;background:#e7e6e6;font:700 10.3pt/10.3pt Arial,sans-serif;text-align:center}.transactions{width:175.6mm;margin-left:17.36mm}.transactions td{height:8.8mm;padding:.35mm .45mm;border:0;text-align:center;vertical-align:middle;font:400 9.6pt/3.3mm Arial,Tahoma,sans-serif}.transactions tr:nth-child(even) td{background:#e7e6e6}.transactions td:nth-child(1){width:26.59mm}.transactions td:nth-child(2){width:48mm}.transactions td:nth-child(3){width:26mm;color:#6b5297;font-size:8.1pt;white-space:nowrap}.transactions td:nth-child(4){width:18.5mm}.transactions td:nth-child(5){width:20mm}.transactions td:nth-child(6){width:36.51mm}.description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-word}.end{width:149.01mm;margin-left:43.95mm;border-top:3pt solid #000;display:grid;grid-template-columns:48mm 26mm 18.5mm 20mm 36.51mm;color:#002060;text-align:center}.end div{padding-top:.44mm;font:700 12pt/12pt 'Times New Roman',serif}.notice{position:absolute;left:16mm;right:16mm;bottom:3.2mm;text-align:center;color:#003A70;font:700 10.5pt/12.5pt Arial,sans-serif}</style></head><body><section class="page"><header class="masthead"><img class="header-art" src="${escapeHtml(data.headerUri)}" alt="Original statement header"><img class="qr" src="${escapeHtml(data.qrUri)}" alt="Verification QR"><div class="meta"><div><b>Customer Name:</b> ${value(data.customerName)}<br><b>Account Number:</b> ${value(data.accountNumber)}<br><b>Momaiz No.:</b> ${value(data.momaizNo)}</div><div><b>Branch Name:</b> ${value(data.branchName)}<br><b>Account Currency:</b> ${value(data.currency)}<br><b>Date:</b> ${value(data.issueDate)}</div></div></header><table class="tx-head"><thead><tr><th>Date</th><th>Movement Description</th><th>Ref No.</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead></table><table class="transactions"><tbody>${tableRows}</tbody></table><section class="end"><div>END OF REPORT</div><div></div><div></div><div>BALANCE</div><div>${balanceAmount(data.closing)}</div></section><p class="notice">Please review this statement and report any discrepancy to AlKuraimi Islamic Microfinance Bank within fifteen (15) calendar days of receipt.</p>${barcodeFooter}</section></body></html>`;
  return documentHtml;
}
