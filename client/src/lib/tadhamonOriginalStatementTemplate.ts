import originalTemplate from "./tadhamon-approved-statement-template.html?raw";
import type { YcbStatementProfile, YcbStatementTransaction } from "./ycbStatementPreview";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currentAdenTime = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Aden" }).format(new Date());

const renderRow = (item: YcbStatementTransaction, highlight = "") => {
  const safeHighlight = /^#[0-9a-fA-F]{6}$/.test(highlight) ? highlight : "";
  const style = safeHighlight ? ` style="--custom-row-color:${safeHighlight};background-color:${safeHighlight}"` : "";
  const cellStyle = safeHighlight ? ` style="background-color:${safeHighlight}!important;background:${safeHighlight}!important;color:#1B365D!important"` : "";
  const reference = escapeHtml(item.reference);
  const click = ` onclick="window.parent.postMessage({type:'ycb-highlight',reference:'${reference}'},'*')" title="Click to highlight"`;
  return `<div class="row${item.credit ? " credit-row" : ""}${safeHighlight ? " custom-row" : ""}" data-reference="${reference}"${style}${click}><div class="cell centered"${cellStyle}>${escapeHtml(item.date)}</div><div class="cell centered"${cellStyle}>${reference}</div><div class="cell"${cellStyle}>${escapeHtml(item.description)}</div><div class="cell amount"${cellStyle}>${item.credit ? money(item.credit) : "—"}</div><div class="cell amount"${cellStyle}>${item.debit ? money(item.debit) : "—"}</div><div class="cell amount balance"${cellStyle}>${money(item.balance)}</div></div>`;
};
const ycbLayoutOverrides = `<style id="ycb-statement-layout-overrides">
 .page > .top{height:68mm!important}
 .top [style*="border-top:1px solid #d1d7dc"]{border-top:0!important;padding-top:0!important}
 .customer-dob{margin-top:1.6mm;font-size:8pt;line-height:1.18}
 .identity-field{border:1px solid #b7c1c8;padding:1.2mm 1.5mm;margin-bottom:1mm;background:rgba(255,255,255,.9)}
 .identity-field .field-label{display:block;font-weight:800;font-style:italic;text-transform:uppercase}
 .identity-field .field-value{display:block;margin-top:.7mm}
 .address-grid{display:block;margin-top:1mm}
 .address-grid .address-field{min-width:0;border:0;border-bottom:1px solid #b7c1c8;padding:1.2mm 0;background:transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .address-grid .field-label,.customer-dob .field-label{display:block;font-weight:800;font-style:italic;text-transform:uppercase}
 .address-grid .field-value,.customer-dob .field-value{display:block;margin-top:.7mm}
 .summary{grid-template-columns:1fr 27mm!important;height:auto!important;min-height:24mm!important}
 .summary .sum{grid-column:1;display:grid;grid-template-columns:1fr auto;align-items:center;padding:1.4mm 2mm;border-right:0;border-bottom:1px solid #b2bec7}
 .summary .sum:last-of-type{border-bottom:0}
 .summary .code-sum{grid-column:2;grid-row:1 / span 4}
 .code-sum{display:flex;align-items:center;justify-content:center;gap:1mm;padding:1mm;border-left:1px solid #b2bec7}
 .summary-qr{width:22mm;height:22mm;object-fit:contain}
 .financial-code .address-qr{width:13mm!important;height:13mm!important}
 .financial-code .title-pdf417{width:29mm!important;height:7mm!important;margin:0!important}
 .row{grid-template-columns:13% 14% 43% 8% 8% 14%!important}
 .page > .summary{margin-top:3mm!important}
 .page > .table{margin-top:3mm!important}
.address-qr-wrap{position:relative;display:block;width:20mm;height:20mm;flex:0 0 20mm}
.address-qr-wrap .address-qr{position:absolute;inset:0;width:20mm;height:20mm;image-rendering:crisp-edges;image-rendering:-webkit-optimize-contrast}
.address-qr-logo{position:absolute;left:50%;top:50%;width:5.8mm;height:3.8mm;object-fit:contain;transform:translate(-50%,-50%);opacity:.98}
.title-pdf417{width:52mm!important;height:10mm!important;object-fit:fill!important}
 .address-date-of-birth{display:block;margin-top:1.2mm;font-size:8pt;line-height:1.18}
 .address-date-of-birth .label{display:block;font-weight:800;font-style:italic;text-transform:uppercase}
 .address-date-of-birth .value{display:block;margin-top:.7mm;font-weight:400}
 .passport-field,.print-meta{display:block;margin-top:1.2mm;padding-top:1.1mm;border-top:1px solid #b7c1c8}
 .passport-field .field-label,.print-meta .field-label{display:block;font-weight:800;font-style:italic;text-transform:uppercase}
 .passport-field .field-value,.print-meta .field-value{display:block;margin-top:.6mm}
 .page > .notes{margin-top:3mm!important}
 .row:nth-child(odd):not(.head):not(.total) .cell{background:#E2E6EA}
 .row.credit-row .cell{background:#E8F8F5;color:#1B365D}
 .row.credit-row .cell.amount:first-of-type{color:#117A65;font-weight:700}
 .row.custom-row .cell{background-color:var(--custom-row-color)!important;background:var(--custom-row-color)!important;color:#1B365D!important}
 .row.custom-row .balance{background-color:var(--custom-row-color)!important;background:var(--custom-row-color)!important;color:#1B365D!important}
 @media print{.page{margin:0!important}.page > .top{height:68mm!important}.page > .summary{margin-top:3mm!important}.page > .table{margin-top:3mm!important}.page > .notes{margin-top:3mm!important}}
</style>`;

export function renderOriginalTadhamonStatementPage(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], pageNumber: number, pageCount: number, qrUri = "", barcodeUri = "", rowHighlights: Record<string, string> = {}) {
  const opening = money(profile.openingBalance);
  const credit = money(profile.totalCredit);
  const debit = money(profile.totalDebit);
  const closing = money(profile.closingBalance);
  const passportField = profile.passport.trim() ? `<div class="passport-field"><span class="field-label">Passport Number:</span><span class="field-value">${escapeHtml(profile.passport)}</span></div>` : "";
  const printMeta = `<div class="print-meta"><span class="field-label">Print Date:</span><span class="field-value">${escapeHtml(profile.issueDate)}</span><span class="field-label">Print Time:</span><span class="field-value">${escapeHtml(profile.printTime || currentAdenTime())}</span></div>`;
  const page = originalTemplate
    .replace(/<div style="font-weight:800;font-style:italic;text-transform:uppercase">Customer Name<\/div><div style="margin-top:1mm">Arafat Ali Saleh Dilla<\/div>/, `<div class="identity-field"><span class="field-label">Customer Name:</span><span class="field-value">${escapeHtml(profile.customerName)}</span></div><div class="identity-field"><span class="field-label">Date of Birth:</span><span class="field-value">${escapeHtml(profile.dateOfBirth || "—")}</span></div><div class="identity-field"><span class="field-label">Place of Birth:</span><span class="field-value">${escapeHtml(profile.placeOfBirth || "—")}</span></div>`)
    .replace(/<div style="border-top:1px solid #d1d7dc;margin-top:2.2mm;padding-top:1.8mm;font-weight:800;font-style:italic;text-transform:uppercase">Address<\/div>/, "")
    .replace(/<div class="address-line">[\s\S]*?<\/div><\/div><div style="padding:4mm 2mm;text-align:center/, `<div class="address-grid"><div class="address-field"><span class="field-label">Address:</span><span class="field-value">${escapeHtml(profile.address || "—")}</span></div>${passportField}${printMeta}</div></div><div style="padding:4mm 2mm;text-align:center`)
    .replace("AL-ZUBAIRI", escapeHtml(profile.branchName))
    .replace("101-840-21102-326491-000", escapeHtml(profile.accountNumber))
    .replace("05-Feb-2025", escapeHtml(profile.periodStart))
    .replace("24-Jun-2025", escapeHtml(profile.periodEnd))
    .replace(/(<b>Currency:<\/b>\s*)USD(\s*&nbsp;\s*&nbsp;\s*<b>Page:<\/b>\s*)1 of 1/, `$1${escapeHtml(profile.currency)}$2${pageNumber} of ${pageCount}`)
    .replace(/<div class="screenbar">[\s\S]*?<\/div>/, "")
    .replace("Tadhamon Bank · Confidential — Internal Use Only", "Tadhamon Bank")
    .replace("Tadhamon-STMT-2025-001", escapeHtml(profile.statementReference))
    .replace(/<div style="font-size:7.5pt;color:#425766;margin-top:1.4mm">Tadhamon Bank<\/div>/, "")
    .replace(/border-top:1px solid #d1d7dc;/g, "")
    .replace(/<footer class="footer">[\s\S]*?<\/footer>/, "");
  const withCodeAssets = (html: string) => {
    let next = html;
    if (qrUri) next = next.replace(/(<img class="address-qr" src=")[^"]*(")/, `$1${escapeHtml(qrUri)}$2`);
    if (barcodeUri) next = next.replace(/(<img class="title-pdf417" src=")[^"]*(")/, `$1${escapeHtml(barcodeUri)}$2`);
    return next;
  };

  const summaryStart = page.indexOf('<section class="summary">');
  const tableStart = page.indexOf('<section class="table">');
  const notesStart = page.indexOf('<section class="notes">');
  const summary = `<section class="summary"><div class="sum"><div class="label">Opening Balance</div><strong>${opening}</strong></div><div class="sum"><div class="label">Total Credit</div><strong>${credit}</strong></div><div class="sum"><div class="label">Total Debit</div><strong>${debit}</strong></div><div class="sum"><div class="label">Closing Balance</div><strong>${closing}</strong></div><div class="code-sum"><img class="summary-qr" src="${escapeHtml(qrUri)}" alt="QR statement data"><img class="summary-barcode" src="${escapeHtml(barcodeUri)}" alt="Statement barcode"></div></section>`;
  const table = `<section class="table"><div class="row head"><div class="cell centered">Date</div><div class="cell centered">Reference</div><div class="cell centered">Transaction Description</div><div class="cell centered">Credit</div><div class="cell centered">Debit</div><div class="cell centered">Balance</div></div>${transactions.map((item) => renderRow(item, rowHighlights[item.reference])).join("")}<div class="row total"><div class="cell"></div><div class="cell"></div><div class="cell amount">Total:</div><div class="cell amount">${credit}</div><div class="cell amount">${debit}</div><div class="cell amount balance">${closing}</div></div></section>`;
  if (summaryStart >= 0 && tableStart > summaryStart && notesStart > tableStart) {
    return withCodeAssets(`${page.slice(0, summaryStart)}${summary}${table}${page.slice(notesStart)}`)
      .replace("</head>", `${ycbLayoutOverrides}</head>`)
      .replace(/<img class="address-qr"[^>]*>/g, "")
      .replace('fill%3D%22%23172936%22', 'fill%3D%22%232d3192%22')
      .replace(/Page 1 of 1/g, `Page ${pageNumber} of ${pageCount}`);
  }
  return withCodeAssets(page.replace("</head>", `${ycbLayoutOverrides}</head>`))
    .replace(/<img class="address-qr"[^>]*>/g, "")
    .replace('fill%3D%22%23172936%22', 'fill%3D%22%232d3192%22');
}

export function renderTadhamonStatementPages(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], qrSources: string[] = [], barcodeSources: string[] = [], rowHighlights: Record<string, string> = {}) {
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  return Array.from({ length: pageCount }, (_, index) => renderOriginalTadhamonStatementPage({ ...profile, pageNumber: index + 1, pageCount }, transactions.slice(index * pageSize, (index + 1) * pageSize), index + 1, pageCount, qrSources[index], barcodeSources[index], rowHighlights)).join("<div style='page-break-after:always'></div>");
}
