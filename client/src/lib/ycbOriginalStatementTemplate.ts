import originalTemplate from "./ycb-statement-stage1-revised.html?raw";
import type { YcbStatementProfile, YcbStatementTransaction } from "./ycbStatementPreview";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const renderRow = (item: YcbStatementTransaction) => `<div class="row${item.credit ? " credit-row" : ""}"><div class="cell centered">${escapeHtml(item.date)}</div><div class="cell centered">${escapeHtml(item.reference)}</div><div class="cell">${escapeHtml(item.description)}</div><div class="cell amount">${item.credit ? money(item.credit) : "—"}</div><div class="cell amount">${item.debit ? money(item.debit) : "—"}</div><div class="cell amount balance">${money(item.balance)}</div></div>`;
const ycbLayoutOverrides = `<style id="ycb-statement-layout-overrides">
 .page > .top{height:68mm!important}
 .page > .summary{margin-top:3mm!important}
 .page > .table{margin-top:3mm!important}
.address-qr-wrap{position:relative;display:block;width:20mm;height:20mm;flex:0 0 20mm}
.address-qr-wrap .address-qr{position:absolute;inset:0;width:20mm;height:20mm;image-rendering:crisp-edges;image-rendering:-webkit-optimize-contrast}
.address-qr-logo{position:absolute;left:50%;top:50%;width:5.8mm;height:3.8mm;object-fit:contain;transform:translate(-50%,-50%);opacity:.98}
.title-pdf417{width:52mm!important;height:10mm!important;object-fit:fill!important}
 .address-date-of-birth{display:block;margin-top:1.2mm;font-size:8pt;line-height:1.18}
 .address-date-of-birth .label{display:block;font-weight:800;font-style:italic;text-transform:uppercase}
 .address-date-of-birth .value{display:block;margin-top:.7mm;font-weight:400}
 .page > .notes{margin-top:3mm!important}
 @media print{.page{margin:0!important}.page > .top{height:68mm!important}.page > .summary{margin-top:3mm!important}.page > .table{margin-top:3mm!important}.page > .notes{margin-top:3mm!important}}
</style>`;

export function renderOriginalYcbStatementPage(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], pageNumber: number, pageCount: number, qrUri = "", barcodeUri = "") {
  const opening = money(profile.openingBalance);
  const credit = money(profile.totalCredit);
  const debit = money(profile.totalDebit);
  const closing = money(profile.closingBalance);
  const page = originalTemplate
    .replace("Arafat Ali Saleh Dilla", escapeHtml(profile.customerName))
    .replace("Sana'a — Bab Al-Yemen", `${escapeHtml(profile.address || "—")}<div class="address-date-of-birth"><span class="label">Date of Birth:</span><span class="value">${escapeHtml(profile.dateOfBirth || "—")}</span></div>`)
    .replace("AL-ZUBAIRI", escapeHtml(profile.branchName))
    .replace("101-840-21102-326491-000", escapeHtml(profile.accountNumber))
    .replace("05-Feb-2025", escapeHtml(profile.periodStart))
    .replace("24-Jun-2025", escapeHtml(profile.periodEnd))
    .replace(/(<b>Currency:<\/b>\s*)USD(\s*&nbsp;\s*&nbsp;\s*<b>Page:<\/b>\s*)1 of 1/, `$1${escapeHtml(profile.currency)}$2${pageNumber} of ${pageCount}`)
    .replace(/<div class="screenbar">[\s\S]*?<\/div>/, "")
    .replace("Yemen Commercial Bank · Confidential — Internal Use Only", "Yemen Commercial Bank")
    .replace("YCB-STMT-2025-001", escapeHtml(profile.statementReference));
  const withCodeAssets = (html: string) => html
    .replace(/(<img class="address-qr" src=")[^"]*(")/, `$1${escapeHtml(qrUri)}$2`)
    .replace(/(<img class="title-pdf417" src=")[^"]*(")/, `$1${escapeHtml(barcodeUri)}$2`);

  const summaryStart = page.indexOf('<section class="summary">');
  const tableStart = page.indexOf('<section class="table">');
  const notesStart = page.indexOf('<section class="notes">');
  const summary = `<section class="summary"><div class="sum"><div class="label">Opening Balance</div><strong>${opening}</strong></div><div class="sum"><div class="label">Total Credit</div><strong>${credit}</strong></div><div class="sum"><div class="label">Total Debit</div><strong>${debit}</strong></div><div class="sum"><div class="label">Closing Balance</div><strong>${closing}</strong></div></section>`;
  const table = `<section class="table"><div class="row head"><div class="cell centered">Date</div><div class="cell centered">Reference</div><div class="cell centered">Transaction Description</div><div class="cell centered">Credit</div><div class="cell centered">Debit</div><div class="cell centered">Balance</div></div>${transactions.map(renderRow).join("")}<div class="row total"><div class="cell"></div><div class="cell"></div><div class="cell amount">Total:</div><div class="cell amount">${credit}</div><div class="cell amount">${debit}</div><div class="cell amount balance">${closing}</div></div></section>`;
  if (summaryStart >= 0 && tableStart > summaryStart && notesStart > tableStart) {
    return withCodeAssets(`${page.slice(0, summaryStart)}${summary}${table}${page.slice(notesStart)}`)
      .replace("</head>", `${ycbLayoutOverrides}</head>`)
      .replace(/<img class="address-qr"([^>]+)>/, `<span class="address-qr-wrap"><img class="address-qr"$1><img class="address-qr-logo" src="/assets/ycb-logo-transparent.png" alt="YCB logo" /></span>`)
      .replace('fill%3D%22%23172936%22', 'fill%3D%22%232d3192%22')
      .replace(/Page 1 of 1/g, `Page ${pageNumber} of ${pageCount}`);
  }
  return withCodeAssets(page.replace("</head>", `${ycbLayoutOverrides}</head>`))
    .replace(/<img class="address-qr"([^>]+)>/, `<span class="address-qr-wrap"><img class="address-qr"$1><img class="address-qr-logo" src="/assets/ycb-logo-transparent.png" alt="YCB logo" /></span>`)
    .replace('fill%3D%22%23172936%22', 'fill%3D%22%232d3192%22');
}
