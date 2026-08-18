import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderAccountStatusPreview, renderStatementPreview } from "../client/src/lib/documentPreview.ts";
import { withPrintTitle } from "../client/src/lib/printDocument.ts";

const outputDir = resolve(import.meta.dirname, "..", "tmp-print-preview");
mkdirSync(outputDir, { recursive: true });

const baseHref = "http://127.0.0.1:3000/";
const assets = {
  background: "/manus-storage/kuraimi-statement-page-background_280c8240.png",
  header: "/manus-storage/kuraimi-header-strip_446dec3d.png",
  qr: "/manus-storage/kuraimi-qr-logo-reference_fb1ad590.png",
};
const barcodeSvg = "<svg xmlns='http://www.w3.org/2000/svg' width='448' height='54' viewBox='0 0 448 54'><rect width='448' height='54' fill='white'/><g fill='#6b5297'><rect x='4' width='3' height='54'/><rect x='11' width='1' height='54'/><rect x='16' width='5' height='54'/><rect x='27' width='2' height='54'/><rect x='34' width='7' height='54'/><rect x='47' width='2' height='54'/><rect x='54' width='4' height='54'/><rect x='64' width='1' height='54'/><rect x='69' width='6' height='54'/><rect x='81' width='3' height='54'/><rect x='89' width='2' height='54'/><rect x='96' width='7' height='54'/><rect x='109' width='1' height='54'/><rect x='115' width='5' height='54'/><rect x='126' width='3' height='54'/><rect x='134' width='7' height='54'/><rect x='147' width='2' height='54'/><rect x='154' width='4' height='54'/><rect x='164' width='1' height='54'/><rect x='169' width='6' height='54'/><rect x='181' width='3' height='54'/><rect x='189' width='2' height='54'/><rect x='196' width='7' height='54'/><rect x='209' width='1' height='54'/><rect x='215' width='5' height='54'/><rect x='226' width='3' height='54'/><rect x='234' width='7' height='54'/><rect x='247' width='2' height='54'/><rect x='254' width='4' height='54'/><rect x='264' width='1' height='54'/><rect x='269' width='6' height='54'/><rect x='281' width='3' height='54'/><rect x='289' width='2' height='54'/><rect x='296' width='7' height='54'/><rect x='309' width='1' height='54'/><rect x='315' width='5' height='54'/><rect x='326' width='3' height='54'/><rect x='334' width='7' height='54'/><rect x='347' width='2' height='54'/><rect x='354' width='4' height='54'/><rect x='364' width='1' height='54'/><rect x='369' width='6' height='54'/><rect x='381' width='3' height='54'/><rect x='389' width='2' height='54'/><rect x='396' width='7' height='54'/><rect x='409' width='1' height='54'/><rect x='415' width='5' height='54'/><rect x='426' width='3' height='54'/><rect x='435' width='7' height='54'/></g></svg>";
const barcodeUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(barcodeSvg)}`;

const accountStatusHtml = renderAccountStatusPreview({
  backgroundUri: assets.background,
  qrUri: assets.qr,
  customerName: "BADR HASAN RASHED RABEA",
  momaizNo: "1504452",
  passport: "A1234567",
  dateOfBirth: "15/05/1984",
  customerSince: "15/01/2020",
  accountType: "Current Account",
  accountNumber: "20001001504452",
  branchName: "HADDAH",
  currency: "USD",
  issueDate: "15/08/2026",
  issueDateHijri: "02 Safar 1448 AH",
  printTime: "03:00 PM",
  correspondenceDate: "15/08/2026",
  opening: 500,
  credit: 17887.95,
  debit: 8517.95,
  closing: 9870,
  enclosurePages: 1,
  referenceNo: "BAK-ACCT-20260817-9ZF756",
});

const accountStatementHtml = renderStatementPreview({
  headerUri: assets.header,
  qrUri: assets.qr,
  customerName: "BADR HASAN RASHED RABEA",
  accountNumber: "20001001504452",
  momaizNo: "1504452",
  branchName: "HADDAH",
  currency: "USD",
  issueDate: "15/08/2026",
  periodStart: "13/02/2026",
  periodEnd: "13/08/2026",
  statementReference: "BAK-ACCT-20260817-9ZF756",
  pageNumber: 1,
  pageCount: 1,
  barcodeUri,
  barcodeLabel: "REF P1 OF 1",
  closing: 9870,
  transactions: [
    { date: "13/02/2026", description: "Cash deposit at HADDAH branch", operationNumber: "FT260213KQZ", debit: 0, credit: 5000, balance: 5500 },
    { date: "28/02/2026", description: "Incoming transfer from Ahmed Saleh", operationNumber: "FT260228RVM", debit: 0, credit: 850, balance: 6350 },
    { date: "13/08/2026", description: "Cash deposit at HADDAH branch", operationNumber: "FT260813NXP", debit: 0, credit: 3520, balance: 9870 },
  ],
});

writeFileSync(resolve(outputDir, "account-status-print.html"), withPrintTitle(accountStatusHtml, "Account Status Statement", baseHref));
writeFileSync(resolve(outputDir, "account-statement-print.html"), withPrintTitle(accountStatementHtml, "Account Statement", baseHref));

console.log(outputDir);
