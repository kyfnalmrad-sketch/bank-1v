import originalTemplate from "./tadhamon-approved-statement-template.html?raw";
import type { YcbStatementProfile, YcbStatementTransaction } from "./ycbStatementPreview";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");
const money = (value: number | undefined) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currentAdenTime = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Aden" }).format(new Date());

const renderRow = (item: YcbStatementTransaction, highlight = "") => {
  const safeHighlight = /^#[0-9a-fA-F]{6}$/.test(highlight) ? highlight : "";
  const reference = escapeHtml(item.reference);
  const style = safeHighlight ? ` style="--custom-row-color:${safeHighlight};background-color:${safeHighlight}"` : "";
  const cellStyle = safeHighlight ? ` style="background-color:${safeHighlight}!important;background:${safeHighlight}!important;color:#1B365D!important"` : "";
  return `<div class="row${item.credit ? " credit-row" : ""}${safeHighlight ? " custom-row" : ""}" data-reference="${reference}"${style}><div class="cell centered"${cellStyle}>${escapeHtml(item.date)}</div><div class="cell centered"${cellStyle}>${reference}</div><div class="cell"${cellStyle}>${escapeHtml(item.description)}</div><div class="cell amount"${cellStyle}>${item.credit ? money(item.credit) : "—"}</div><div class="cell amount"${cellStyle}>${item.debit ? money(item.debit) : "—"}</div><div class="cell amount balance"${cellStyle}>${money(item.balance)}</div></div>`;
};

export function renderOriginalTadhamonStatementPage(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], pageNumber: number, pageCount: number, qrUri = "", _barcodeUri = "", rowHighlights: Record<string, string> = {}) {
  let page = originalTemplate
    .replace(/<div class="screenbar">[\s\S]*?<\/div>/, "")
    .replace("Arafat Ali Saleh Dilla", escapeHtml(profile.customerName))
    .replace("Sana'a — Bab Al-Yemen", escapeHtml(profile.address || "—"))
    .replace("P1234567", escapeHtml(profile.passport || "—"))
    .replace("AL-ZUBAIRI", escapeHtml(profile.branchName))
    .replace("101-840-21102-326491-000", escapeHtml(profile.accountNumber))
    .replace("05-Feb-2025", escapeHtml(profile.periodStart))
    .replace("24-Jun-2025", escapeHtml(profile.periodEnd))
    .replace(/(<b>Currency:<\/b>\s*)USD(\s*&nbsp;\s*&nbsp;\s*<b>Page:<\/b>\s*)1 of 1/, `$1${escapeHtml(profile.currency)}$2${pageNumber} of ${pageCount}`)
    .replace(/id="print-date">[^<]*/, `id="print-date">${escapeHtml(profile.issueDate)}`)
    .replace(/id="print-time">[^<]*/, `id="print-time">${escapeHtml(profile.printTime || currentAdenTime())}`)
    .replace("3,500.00", money(profile.openingBalance))
    .replace("13,548.00", money(profile.totalCredit))
    .replace("5,600.00", money(profile.totalDebit))
    .replace("23,231.00", money(profile.closingBalance))
    .replace("TAD-STMT-2025-001", escapeHtml(profile.statementReference));

  const tableStart = page.indexOf('<section class="table">');
  const notesStart = page.indexOf('<section class="notes">');
  if (tableStart >= 0 && notesStart > tableStart) {
    const head = '<div class="row head"><div class="cell centered">Date</div><div class="cell centered">Reference</div><div class="cell centered">Transaction Description</div><div class="cell centered">Credit</div><div class="cell centered">Debit</div><div class="cell centered">Balance</div></div>';
    const table = `<section class="table">${head}${transactions.map((item) => renderRow(item, rowHighlights[item.reference])).join("")}<div class="row total"><div class="cell"></div><div class="cell"></div><div class="cell amount">Total:</div><div class="cell amount">${money(profile.totalCredit)}</div><div class="cell amount">${money(profile.totalDebit)}</div><div class="cell amount balance">${money(profile.closingBalance)}</div></div></section>`;
    page = `${page.slice(0, tableStart)}${table}${page.slice(notesStart)}`;
  }
  page = page.replace(/class="summary-qr"/, 'class="code-sum"');
  if (!profile.passport.trim()) page = page.replace(/<div class="address-date-of-birth">[\s\S]*?<\/div>/, "");
  page = page.replace(/<footer class="footer">[\s\S]*?<\/footer>/, `<footer class="footer"><span>Tadhamon Bank - R.Y.</span><span>Statement Reference: ${escapeHtml(profile.statementReference)}</span><span>Page ${pageNumber} of ${pageCount}</span></footer>`);
  if (qrUri) page = page.replace(/(<div class="code-sum">\s*<img[^>]*src=")[^"]*(")/, `$1${escapeHtml(qrUri)}$2`);
  return page;
}

export function renderTadhamonStatementPages(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], qrSources: string[] = [], barcodeSources: string[] = [], rowHighlights: Record<string, string> = {}) {
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return renderOriginalTadhamonStatementPage(
      { ...profile, pageNumber, pageCount },
      transactions.slice(index * pageSize, (index + 1) * pageSize),
      pageNumber,
      pageCount,
      qrSources[index] || qrSources[0] || "",
      barcodeSources[index] || barcodeSources[0] || "",
      rowHighlights,
    );
  });
}
