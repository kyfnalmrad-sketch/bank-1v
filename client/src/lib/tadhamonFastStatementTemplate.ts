import type { YcbStatementProfile, YcbStatementTransaction } from "./ycbStatementPreview";

export type TadhamonFastStatementProfile = YcbStatementProfile & {
  bankName?: string;
  openingDate?: string;
  customerSince?: string;
  holderNameAr?: string;
  statementTime?: string;
  qrUri?: string;
};

const esc = (value: unknown) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
const money = (value: number | undefined) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value: unknown) => String(value ?? "").trim() || "—";
const shortName = (value: unknown) => { const parts = String(value || "").trim().split(/\s+/).filter(Boolean); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "—"; };

const css = `@page{size:A4;margin:0}:root{--yellow:#fff200;--red:#e53218;--line:#171717;--blue:#9bd5e4}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e8e8e8;color:#111;font-family:Arial,Tahoma,sans-serif}body{padding:12px 0}.page{width:210mm;height:297mm;min-height:0;margin:0 auto 12px;padding:3mm 5mm;background:#fff;box-shadow:0 0 8px #999;overflow:hidden;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.top-info{display:grid;grid-template-columns:13.5% 13% 19% 11.2% 11.2% 13.6% 18.5%;grid-template-rows:8mm;width:100%;height:8mm;margin:0 auto 1mm;align-items:stretch;position:relative;top:0}.info-box{border:1.1px solid var(--line);border-right:0;text-align:center;background:linear-gradient(#f4da4e,#fff7a7);height:8mm;min-height:8mm;max-height:8mm;overflow:visible}.info-box:last-child{border-right:1.1px solid var(--line)}.info-label{display:block;font-weight:700;font-size:6.2pt;padding:.8mm .5mm .5mm;border-bottom:1px solid var(--line);line-height:1.02}.ar{display:block;font-size:5.8pt;font-weight:700}.info-value{display:block;height:3.4mm;padding:.1mm;font-size:5.8pt;line-height:1.05;font-weight:700;white-space:nowrap;overflow:visible}.account-number-value{font-size:5.8pt;letter-spacing:-.12px;overflow:visible}.statement{width:100%;margin:0 auto;border-collapse:collapse;table-layout:fixed;direction:ltr;font-size:6.8pt;font-weight:700}.statement th,.statement td{border:1px solid var(--line);padding:.35mm .45mm;text-align:center;vertical-align:middle;line-height:1.05;height:var(--quick-row-height,7.5mm);min-height:var(--quick-row-height,7.5mm);max-height:var(--quick-row-height,7.5mm);overflow:hidden}.statement thead th{background:var(--red);color:#fff;font-weight:700;height:6mm;min-height:6mm;font-size:5.6pt}.statement thead .ar{font-size:5.5pt}.statement col.date{width:12%}.statement col.ref{width:12%}.statement col.desc{width:24%}.statement col.debit{width:10.5%}.statement col.credit{width:10.5%}.statement col.balance{width:14%}.statement col.remarks{width:17%}.statement tbody tr{background:var(--yellow);height:var(--quick-row-height,7.5mm)}.statement tbody tr:nth-child(5n){background:var(--yellow)}.statement tr.deposit td{background:var(--yellow)}.statement tr.highlight td{background:var(--highlight-color,#fff)!important;color:#111!important}.statement td.desc-cell{font-weight:700;font-size:6.7pt;line-height:1.05;white-space:normal;overflow:hidden;text-overflow:clip;overflow-wrap:anywhere;word-break:normal;height:var(--quick-row-height,7.5mm);min-height:var(--quick-row-height,7.5mm);max-height:var(--quick-row-height,7.5mm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.bottom-date{display:flex;width:100%;margin:.8mm 0 0;border:1.1px solid var(--line);font-weight:700;direction:ltr;font-size:5.5pt;white-space:nowrap}.bottom-date>*{padding:.15mm .8mm;min-height:3.2mm;text-align:center}.bottom-date .date-label{width:42%;background:#e9df78}.bottom-date .date-value{width:58%;background:#fff}.footer{margin:1.2mm 0 0;width:100%;display:flex;gap:10mm;align-items:flex-start;direction:ltr}.identity-block{width:100%}.closing-row{display:flex;justify-content:space-between;align-items:flex-start;margin-top:1.2mm}.closing-row>div:first-child{width:26.5%;flex:0 0 26.5%}.qr-block{width:30mm;margin-left:auto;text-align:center;color:#111}.qr-name{display:block;font-size:6pt;font-weight:700;line-height:1.05;margin-bottom:.8mm}.qr-image{display:block;width:25mm;height:25mm;margin:0 auto;image-rendering:pixelated}.name-box{background:linear-gradient(#9bdae9,#64b5c9);border:1px solid #5599a8;text-align:center;padding:.55mm 1mm;font-size:6.4pt;font-weight:700;min-height:8mm;white-space:nowrap;direction:ltr}.name-ar{display:block;font-size:6.4pt;margin-top:.15mm;direction:rtl}.total-row{position:relative;display:block;direction:ltr;margin:0;width:100%;font-size:8.5pt}.total-row>div{border:1.1px solid var(--line);min-height:7mm;display:flex;align-items:center;justify-content:center;font-weight:700}.total-combined{width:100%;background:#fff200;font-size:8.5pt;white-space:nowrap;padding:0 1mm;direction:ltr}.time{position:absolute;left:calc(100% + 2mm);top:0;width:max-content;color:#9b1b1b;font-size:7pt;background:#fff;white-space:nowrap;padding:1.8mm 1mm}@media print{html,body{background:#fff;padding:0}.page{margin:0;box-shadow:none}}`;

function header(profile: TadhamonFastStatementProfile, style = "") {
  return `<section class="top-info"${style}><div class="info-box"><span class="info-label">Account Opening Date<span class="ar">تاريخ فتح الحساب</span></span><span class="info-value">${esc(profile.openingDate || profile.customerSince || "—")}</span></div><div class="info-box" style="grid-column:2 / span 4"><span class="info-label">Account Number<span class="ar">رقم الحساب</span></span><span class="info-value account-number-value">${esc(profile.accountNumber)}</span></div><div class="info-box" style="grid-column:6 / span 2"><span class="info-label">Opening Balance<span class="ar">الرصيد الافتتاحي</span></span><span class="info-value">${money(profile.openingBalance)}</span></div></section>`;
}

function tableHeader() {
  return `<thead><tr><th>Date<span class="ar">التاريخ</span></th><th>Reference<span class="ar">رقم العملية / المرجع</span></th><th>Description<span class="ar">تفاصيل البيان</span></th><th>Debit<span class="ar">سحب / مدين</span></th><th>Credit<span class="ar">إيداع / دائن</span></th><th>Balance<span class="ar">الرصيد</span></th><th>Remarks<span class="ar">ملاحظات</span></th></tr></thead>`;
}

function row(item: YcbStatementTransaction, highlights: Record<string, string>) {
  const highlightColor = ((item.credit || 0) > 0 || (item.debit || 0) > 0) && /^#[0-9a-fA-F]{6}$/.test(highlights[item.reference] || "") ? highlights[item.reference] : "";
  const highlight = highlightColor ? ` highlight" style="--highlight-color:${highlightColor}` : "";
  const deposit = (item.credit || 0) > 0 ? " deposit" : "";
  const cells = [dateText(item.date), item.reference, item.description, item.debit ? money(item.debit) : "", item.credit ? money(item.credit) : "", money(item.balance), ""];
  return `<tr class="${highlight || deposit}">${cells.map((value, index) => `<td class="${index === 2 ? "desc-cell" : ""}">${esc(value)}</td>`).join("")}</tr>`;
}

function closing(profile: TadhamonFastStatementProfile, qrUri: string) {
  return `<div class="closing-row"><div><div class="bottom-date"><div class="date-label">DATE / التاريخ</div><div class="date-value">${esc(profile.issueDate)}</div></div><section class="footer"><div class="identity-block"><div class="name-box"><span>${esc(profile.customerName)}</span><span class="name-ar">${esc(profile.holderNameAr || "—")}</span></div><div class="total-row"><div class="total-combined">Total Balance: ${money(profile.closingBalance)}</div><div class="time">Time: <span>${esc(profile.statementTime || "—")}</span></div></div></div></section></div><div class="qr-block"><span class="qr-name">${esc(shortName(profile.customerName))}</span>${qrUri ? `<img class="qr-image" alt="QR code for account holder" src="${esc(qrUri)}">` : ""}</div></div>`;
}

export function renderTadhamonFastStatement(profile: TadhamonFastStatementProfile, transactions: YcbStatementTransaction[], highlights: Record<string, string> = {}, rowsPerPage = 32) {
  const safeRowsPerPage = 32;
  const pages = Math.max(1, Math.ceil(transactions.length / safeRowsPerPage));
  const isKarimi = profile.bankName === "بنك الكريمي";
  const isYcb = profile.bankName === "البنك التجاري اليمني";
  const pageMarkup = Array.from({ length: pages }, (_, pageIndex) => {
    const pageRows = transactions.slice(pageIndex * safeRowsPerPage, (pageIndex + 1) * safeRowsPerPage);
    const isLast = pageIndex === pages - 1;
    const rowHeight = 7.5;
    const headerStyle = isKarimi ? ` style="top:-1mm"` : "";
    return `<main class="page">${pageIndex === 0 ? header(profile, headerStyle) : ""}<table class="statement" style="--quick-row-height:${rowHeight}mm"><colgroup><col class="date"><col class="ref"><col class="desc"><col class="debit"><col class="credit"><col class="balance"><col class="remarks"></colgroup>${tableHeader()}<tbody>${pageRows.map((item) => row(item, highlights)).join("")}</tbody></table>${isLast ? closing(profile, profile.qrUri || "") : ""}</main>`;
  }).join("");
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>${esc(profile.bankName || "Tadhamon Bank")} — Quick Account Statement</title><style>${css}</style></head><body>${pageMarkup}</body></html>`;
}

export function renderTadhamonFastStatementPages(profile: TadhamonFastStatementProfile, transactions: YcbStatementTransaction[], highlights: Record<string, string> = {}, rowsPerPage = 32) {
  return renderTadhamonFastStatement(profile, transactions, highlights, rowsPerPage);
}
