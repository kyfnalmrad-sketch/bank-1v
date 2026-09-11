import { writeFileSync } from "node:fs";
import { renderTadhamonOfficialStatusPreview } from "../client/src/lib/tadhamonOfficialStatusTemplate";

const html = renderTadhamonOfficialStatusPreview({
  backgroundUri: "file:///home/ubuntu/bank-karimi-web-staging/client/public/assets/tadhamon-status-background.png",
  qrUri: "file:///home/ubuntu/bank-karimi-web-staging/client/public/assets/qr-brand-logo-transparent.png",
  qrLogoUri: "file:///home/ubuntu/bank-karimi-web-staging/client/public/assets/qr-brand-logo-transparent.png",
  bankName: "Tadhamon Bank",
  customerName: "Arafat Ali Saleh Dilla",
  momaizNo: "1504452",
  passport: "P1234567",
  dateOfBirth: "01-Jan-1990",
  customerSince: "15-Jan-2020",
  accountType: "Personal Current Account",
  accountNumber: "101-840-21102-326491-000",
  branchName: "AL-ZUBAIRI",
  currency: "USD",
  opening: 3500,
  credit: 13548,
  debit: 5600,
  closing: 23231,
  issueDate: "11-Sep-2026",
  issueDateHijri: "18 ربيع الأول 1448 هـ",
  printTime: "17:19:00",
  correspondenceDate: "11-Sep-2026",
  periodStart: "05-Feb-2025",
  periodEnd: "24-Jun-2025",
  referenceNo: "TAD-STATUS-2026-001",
  enclosurePages: 1,
  transactionCount: 0,
  debitCount: 0,
  creditCount: 0,
  status: "Active",
});
writeFileSync("/home/ubuntu/bank-karimi-tadhamon-status-preview.html", html);
console.log("wrote /home/ubuntu/bank-karimi-tadhamon-status-preview.html");
