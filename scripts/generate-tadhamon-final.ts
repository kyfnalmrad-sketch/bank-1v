import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import { chromium } from "playwright-core";

const root = "/home/ubuntu/bank-karimi-web-staging";
const publicRoot = `${root}/client/public`;
const out = "/home/ubuntu/bank-karimi-delivery/Tadhamon-final-sample-15-per-page.pdf";
const template = readFileSync(`${root}/client/src/lib/tadhamon-approved-statement-template.html`, "utf8");
const logoUri = `data:image/png;base64,${readFileSync(`${publicRoot}/assets/tadhamon/STMTDM1-official-background.png`).toString("base64")}`;
const esc = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const money = (v: number) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const openingBalance = 1000;
const rows = Array.from({ length: 30 }, (_, index) => {
  const n = index + 1;
  const credit = n % 2 === 0 ? 40 + index * 2 : 0;
  const debit = n % 2 === 1 ? 25 + index * 3 : 0;
  return { date: `15/${String((index % 12) + 1).padStart(2, "0")}/2026`, reference: `FT2608${String(n).padStart(3, "0")}`, description: n % 3 === 1 ? `ATM cash withdrawal — customer transaction ${n} / HADDAH branch` : `Account activity description ${n}`, credit, debit, balance: 0 };
});
let balance = openingBalance;
for (const row of rows) { balance += row.credit - row.debit; row.balance = balance; }
const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
const profile = { customerName: "Random Customer", address: "Sana'a — Bab Al-Yemen", dateOfBirth: "12-Apr-1988", branchName: "HADDAH", accountNumber: "1002345678", currency: "USD", periodStart: "01-Jan-2026", periodEnd: "15-Jun-2026", statementReference: "TDB-LOCAL-20260815-0030", openingBalance, totalCredit, totalDebit, closingBalance: balance };
const overrides = `<style>.page>.top{height:68mm!important}.page>.summary{margin-top:3mm!important}.page>.table{margin-top:3mm!important}.page>.notes{margin-top:3mm!important}.row:nth-child(odd):not(.head):not(.total) .cell{background:#E2E6EA}.row.credit-row .cell{background:#E8F8F5;color:#1B365D}.address-qr-wrap{position:relative;display:block;width:20mm;height:20mm}.address-qr-wrap .address-qr{position:absolute;inset:0;width:20mm;height:20mm}.address-qr-logo{position:absolute;left:50%;top:50%;width:5.8mm;height:3.8mm;object-fit:contain;transform:translate(-50%,-50%)}@media print{.page{margin:0!important}}</style>`;
const renderPage = async (pageRows: typeof rows, pageNumber: number, pageCount: number) => {
  const qrUri = await QRCode.toDataURL(`TYPE: Tadhamon statement\nREF: ${profile.statementReference}\nTX: ${pageRows.length}\nPAGE: ${pageNumber}/${pageCount}\nCLOSE: ${pageRows.at(-1)?.balance.toFixed(2)}`, { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#2d3192", light: "#ffffff" } });
  const svg = bwipjs.toSVG({ bcid: "pdf417", text: `TADHAMON|VERIFY|${profile.statementReference}|P${pageNumber}|TX=${pageRows.length}`, scaleX: 2, scaleY: 2, padding: 4, backgroundcolor: "FFFFFF", barcolor: "2D3192" });
  const barcodeUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const row = (item: typeof rows[number]) => `<div class="row${item.credit ? " credit-row" : ""}"><div class="cell centered">${esc(item.date)}</div><div class="cell centered">${esc(item.reference)}</div><div class="cell">${esc(item.description)}</div><div class="cell amount">${item.credit ? money(item.credit) : "—"}</div><div class="cell amount">${item.debit ? money(item.debit) : "—"}</div><div class="cell amount balance">${money(item.balance)}</div></div>`;
  const summary = `<section class="summary"><div class="sum"><div class="label">Opening Balance</div><strong>${money(profile.openingBalance)}</strong></div><div class="sum"><div class="label">Total Credit</div><strong>${money(profile.totalCredit)}</strong></div><div class="sum"><div class="sum"><div class="label">Total Debit</div><strong>${money(profile.totalDebit)}</strong></div></div><div class="sum"><div class="label">Closing Balance</div><strong>${money(pageRows.at(-1)?.balance ?? profile.closingBalance)}</strong></div></section>`;
  const table = `<section class="table"><div class="row head"><div class="cell centered">Date</div><div class="cell centered">Reference</div><div class="cell centered">Transaction Description</div><div class="cell centered">Credit</div><div class="cell centered">Debit</div><div class="cell centered">Balance</div></div>${pageRows.map(row).join("")}<div class="row total"><div class="cell"></div><div class="cell"></div><div class="cell amount">Total:</div><div class="cell amount">${money(pageRows.reduce((s, r) => s + r.credit, 0))}</div><div class="cell amount">${money(pageRows.reduce((s, r) => s + r.debit, 0))}</div><div class="cell amount balance">${money(pageRows.at(-1)?.balance ?? 0)}</div></div></section>`;
  let html = template.replace("Arafat Ali Saleh Dilla", esc(profile.customerName)).replace("Sana'a — Bab Al-Yemen", `${esc(profile.address)}<div class="address-date-of-birth"><span class="label">Date of Birth:</span><span class="value">${esc(profile.dateOfBirth)}</span></div>`).replace("AL-ZUBAIRI", esc(profile.branchName)).replace("101-840-21102-326491-000", esc(profile.accountNumber)).replace("05-Feb-2025", esc(profile.periodStart)).replace("24-Jun-2025", esc(profile.periodEnd)).replace(/(<b>Currency:<\/b>\s*)USD(\s*&nbsp;\s*&nbsp;\s*<b>Page:<\/b>\s*)1 of 1/, `$1${esc(profile.currency)}$2${pageNumber} of ${pageCount}`).replace(/<div class="screenbar">[\s\S]*?<\/div>/, "").replace("Tadhamon-STMT-2025-001", esc(profile.statementReference)).replace(/(<img class="address-qr" src=")[^"]*(")/, `$1${qrUri}$2`).replace(/(<img class="title-pdf417" src=")[^"]*(")/, `$1${barcodeUri}$2`);
  const summaryStart = html.indexOf('<section class="summary">');
  const tableStart = html.indexOf('<section class="table">');
  const notesStart = html.indexOf('<section class="notes">');
  html = `${html.slice(0, summaryStart)}${summary}${table}${html.slice(notesStart)}`.replace("</head>", `${overrides}</head>`).replace(/Page 1 of 1/g, `Page ${pageNumber} of ${pageCount}`).replace(/<img class="address-qr"([^>]+)>/, `<span class="address-qr-wrap"><img class="address-qr"$1><img class="address-qr-logo" src="${logoUri}" alt="Tadhamon logo" /></span>`).replace("Tadhamon Bank · Confidential — Internal Use Only", "Tadhamon Bank");
  return html;
};
const pageCount = 2;
const pages = [];
for (let i = 0; i < pageCount; i++) pages.push(await renderPage(rows.slice(i * 15, (i + 1) * 15), i + 1, pageCount));
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${pages.join("<div style='page-break-after:always'></div>")}</body></html>`, { waitUntil: "load" });
await page.pdf({ path: out, format: "A4", printBackground: true, margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
await browser.close();
console.log(`Created ${out}: ${rows.length} transactions, ${pageCount} pages, 15 per page.`);
