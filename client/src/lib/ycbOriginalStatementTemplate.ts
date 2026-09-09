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

export function renderOriginalYcbStatementPage(profile: YcbStatementProfile, transactions: YcbStatementTransaction[], pageNumber: number, pageCount: number) {
  const opening = money(profile.openingBalance);
  const credit = money(profile.totalCredit);
  const debit = money(profile.totalDebit);
  const closing = money(profile.closingBalance);
  const page = originalTemplate
    .replace("Arafat Ali Saleh Dilla", escapeHtml(profile.customerName))
    .replace("Sana'a — Bab Al-Yemen", escapeHtml(profile.address || "—"))
    .replace("AL-ZUBAIRI", escapeHtml(profile.branchName))
    .replace("101-840-21102-326491-000", escapeHtml(profile.accountNumber))
    .replace("05-Feb-2025", escapeHtml(profile.periodStart))
    .replace("24-Jun-2025", escapeHtml(profile.periodEnd))
    .replace(">USD &nbsp;&nbsp; <b>Page:</b> 1 of 1", `>${escapeHtml(profile.currency)} &nbsp;&nbsp; <b>Page:</b> ${pageNumber} of ${pageCount}`)
    .replace("YCB-STMT-2025-001", escapeHtml(profile.statementReference));

  const summaryStart = page.indexOf('<section class="summary">');
  const tableStart = page.indexOf('<section class="table">');
  const notesStart = page.indexOf('<section class="notes">');
  const summary = `<section class="summary"><div class="sum"><div class="label">Opening Balance</div><strong>${opening}</strong></div><div class="sum"><div class="label">Total Credit</div><strong>${credit}</strong></div><div class="sum"><div class="label">Total Debit</div><strong>${debit}</strong></div><div class="sum"><div class="label">Closing Balance</div><strong>${closing}</strong></div></section>`;
  const table = `<section class="table"><div class="row head"><div class="cell centered">Date</div><div class="cell centered">Reference</div><div class="cell centered">Transaction Description</div><div class="cell centered">Credit</div><div class="cell centered">Debit</div><div class="cell centered">Balance</div></div>${transactions.map(renderRow).join("")}<div class="row total"><div class="cell"></div><div class="cell"></div><div class="cell amount">Total:</div><div class="cell amount">${credit}</div><div class="cell amount">${debit}</div><div class="cell amount balance">${closing}</div></div></section>`;
  if (summaryStart >= 0 && tableStart > summaryStart && notesStart > tableStart) {
    return `${page.slice(0, summaryStart)}${summary}${table}${page.slice(notesStart)}`
      .replace(/Page 1 of 1/g, `Page ${pageNumber} of ${pageCount}`);
  }
  return page;
}
