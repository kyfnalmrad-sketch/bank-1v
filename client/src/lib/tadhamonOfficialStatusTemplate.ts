import officialTemplate from "./tadhamon-official-letterhead.html?raw";
import type { AccountStatusPreviewInput } from "./documentPreview";

const esc = (value: unknown) => String(value ?? "—")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const text = (value: unknown) => esc(value || "—");
const shortName = (value: unknown) => { const parts = String(value || "").trim().split(/\s+/).filter(Boolean); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "—"; };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const replaceId = (html: string, id: string, value: unknown) => html.replace(new RegExp(`(<(?:span|div)[^>]*id="${id}"[^>]*>)[\\s\\S]*?(</(?:span|div)>)`), `$1${text(value)}$2`);

/** The official Tadhamon package is kept as the source of truth for the status certificate. */
export function renderTadhamonOfficialStatusPreview(data: AccountStatusPreviewInput) {
  let html = officialTemplate
    .replace(/<form class="controls"[\s\S]*?<\/form>/, "")
    .replace(/<script src="qrcode-bundle\.js"><\/script>[\s\S]*?<script>[\s\S]*?<\/script>/, "")
    .replace("official-paper/page-1.png", esc(data.backgroundUri))
    .replace('src="qr-client.png"', `src="${esc(data.qrUri)}"`)
    .replace("SAMPLE CUSTOMER", text(data.customerName))
    .replace("0000000000", text(data.accountNumber))
    .replace("0.00 YER", `${money(data.closing)} ${text(data.currency)}`)
    .replace(/<span class="strong">Current Account<\/span>/, `<span class="strong">${text(data.accountType)}<\/span>`)
    .replace(/<span class="name">—<\/span>/g, (() => {
      let count = 0;
      return () => `<span class="name">${text(count++ === 0 ? data.employeeName : data.managerName)}</span>`;
    })());

  html = replaceId(html, "outReference", data.referenceNo);
  html = replaceId(html, "outDate", data.issueDate);
  html = replaceId(html, "outHijri", data.issueDateHijri);
  html = replaceId(html, "outSince", data.customerSince);
  html = replaceId(html, "outCustomer", data.customerName);
  html = replaceId(html, "outAccount", data.accountNumber);
  html = replaceId(html, "outBalance", `${money(data.closing)} ${data.currency}`);
  html = replaceId(html, "outDateBody", data.issueDate);
  html = replaceId(html, "outDob", data.dateOfBirth);
  html = replaceId(html, "outPlace", data.placeOfBirth || "Sana'a, Yemen");
  html = replaceId(html, "outPeriodStart", data.periodStart || data.correspondenceDate);
  html = replaceId(html, "outPeriodEnd", data.periodEnd || data.customerSince);
  html = html.replace(/<div[^>]*id="qrName"[^>]*>[\s\S]*?<\/div>/, `<div id="qrName" class="header-qr-right-label">${text(shortName(data.customerName))}</div>`);
  return html;
}
