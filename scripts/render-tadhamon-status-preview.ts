import { readFileSync, writeFileSync } from "node:fs";

const esc = (value: unknown) => String(value ?? "—")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const text = (value: unknown) => esc(value || "—");
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = { customerName: "Arafat Ali Saleh Dilla", accountNumber: "101-840-21102-326491-000", closing: 23231, currency: "USD", referenceNo: "TAD-STATUS-2026-001", issueDate: "11-Sep-2026", issueDateBody: "11 September 2026", issueDateHijri: "18 ربيع الأول 1448 هـ", customerSince: "15-Jan-2020", accountType: "Personal Current Account", employeeName: "", managerName: "" };
let html = readFileSync("client/src/lib/tadhamon-official-letterhead.html", "utf8")
  .replace(/<form class="controls"[\s\S]*?<\/form>/, "")
  .replace(/<script src="qrcode-bundle\.js"><\/script>[\s\S]*?<script>[\s\S]*?<\/script>/, "")
  .replace("official-paper/page-1.png", "file:///home/ubuntu/bank-karimi-web-staging/client/public/assets/tadhamon-official-paper.png")
  .replace('src="qr-client.png"', 'src="file:///home/ubuntu/bank-karimi-web-staging/client/public/assets/tadhamon-official-qr-client.png"')
  .replace(/SAMPLE CUSTOMER/g, text(data.customerName))
  .replace(/0000000000/g, text(data.accountNumber))
  .replace(/0\.00 YER/g, `${money(data.closing)} ${text(data.currency)}`)
  .replace(/<span class="strong">Current Account<\/span>/, `<span class="strong">${text(data.accountType)}</span>`)
  .replace("SAMPLE-TIIB-1V11", text(data.referenceNo)).replace("11 SEP 2026", text(data.issueDate))
  .replace("٢٩ ربيع الأول ١٤٤٨ هـ", text(data.issueDateHijri)).replace("01 January 2024", text(data.customerSince))
  .replace("11 September 2026", text(data.issueDateBody));
writeFileSync("/home/ubuntu/bank-karimi-tadhamon-status-preview.html", html);
console.log("wrote /home/ubuntu/bank-karimi-tadhamon-status-preview.html");
