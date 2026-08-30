import { readFileSync, writeFileSync } from "node:fs";
import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import { renderStatementPreview } from "../client/src/lib/documentPreview";

const fileDataUrl = (path: string, mime: string) => `data:${mime};base64,${readFileSync(path).toString("base64")}`;
const root = "/home/ubuntu/bank-karimi-web-staging/client/public";
const headerUri = fileDataUrl(`${root}/assets/reference-header-strip.png`, "image/png");
const qrLogoUri = fileDataUrl(`${root}/assets/qr-brand-logo-transparent.png`, "image/png");
const transactions = Array.from({ length: 15 }, (_, index) => ({
  date: `15/${String((index % 9) + 1).padStart(2, "0")}/2026`,
  description: index % 3 === 0 ? `ATM cash withdrawal — customer transaction ${index + 1} / HADDAH branch` : `Account activity description ${index + 1}`,
  branch: index % 2 === 0 ? "HADDAH" : "SANA'A",
  operationNumber: `FT2608${String(index + 1).padStart(3, "0")}`,
  debit: index % 2 === 0 ? 25 + index * 3 : 0,
  credit: index % 2 === 1 ? 40 + index * 2 : 0,
  balance: 1000 + (index % 2 === 0 ? -(25 + index * 3) : 40 + index * 2),
}));
const qrUri = await QRCode.toDataURL("TYPE: statement\nREF: BAK-LOCAL-20260815-0015\nTX: 15\nCLOSE: 1120.00", { width: 420, margin: 2, errorCorrectionLevel: "H", color: { dark: "#6b5297", light: "#ffffff" } });
const svg = bwipjs.toSVG({ bcid: "pdf417", text: "KURAIMI|VERIFY|STMT|BAK-LOCAL-20260815-0015|P1|CHK=1234ABCD", scaleX: 2, scaleY: 2, padding: 4, backgroundcolor: "FFFFFF", barcolor: "6B5297" });
const barcodeUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const base = { headerUri, qrUri, qrLogoUri, customerName: "Random Customer", accountNumber: "1002345678", momaizNo: "1504452", branchName: "HADDAH", currency: "USD", issueDate: "15/08/2026", periodStart: "01/08/2026", periodEnd: "15/08/2026", statementReference: "BAK-LOCAL-20260815-0015", pageNumber: 1, pageCount: 1, barcodeUri, barcodeLabel: "REF P1 of 1", closing: 1120, pageSummary: { debitCount: 8, creditCount: 7, totalDebit: 356, totalCredit: 448, openingBalance: 1028, firstReference: "FT2608001", lastReference: "FT2608015" }, transactions };
const frame = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;background:#d7d8df;display:flex;gap:24px;justify-content:center;align-items:flex-start;padding:24px;font-family:Arial,sans-serif}.sample{background:#fff;box-shadow:0 4px 20px #3335}.sample h2{position:fixed;top:0;margin:0;padding:6px 12px;background:#3f2b68;color:#fff;font:700 14px Arial}iframe{border:0;width:210mm;height:297mm}</style></head><body>${body}</body></html>`;
const withBranch = renderStatementPreview({ ...base, includeBranch: true });
const withoutBranch = renderStatementPreview({ ...base, includeBranch: false });
writeFileSync("/home/ubuntu/bank-karimi-web-staging/local-preview-with-branch.html", frame("Branch enabled", `<div class="sample"><h2>Branch enabled</h2><iframe srcdoc='${withBranch.replace(/'/g, "&#39;")}'></iframe></div>`));
writeFileSync("/home/ubuntu/bank-karimi-web-staging/local-preview-without-branch.html", frame("Branch disabled", `<div class="sample"><h2>Branch disabled</h2><iframe srcdoc='${withoutBranch.replace(/'/g, "&#39;")}'></iframe></div>`));
console.log("Created local previews with 15 random transactions, real header/QR assets, and a generated barcode.");
