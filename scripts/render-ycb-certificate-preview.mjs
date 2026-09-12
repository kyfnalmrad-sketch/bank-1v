import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { renderYcbCertificateHtml } from "../client/src/components/YcbCertificateWorkspace.tsx";

const root = process.cwd();
const client = {
  name: "Ahmed Mohammed Al-Qahtani",
  passport: "P1234567",
  branch: "Sana’a Main Branch",
  customerSince: "15/01/2020",
  dateOfBirth: "1988-04-12",
  placeOfBirth: "Sana'a, Yemen",
  accountNumber: "YCB-0045827319",
  accountType: "Current Account",
  currency: "YER",
  opening: "1250000",
  issueDate: "2026-09-11",
  referenceNumber: "YCB-DEMO-2026-091",
  customerServiceName: "Sarah Abdullah Al-Maqtari",
  branchManagerName: "Khaled Ali Al-Hadrami",
  periodStart: "2026-01-01",
  periodEnd: "2026-08-31",
};
let html = renderYcbCertificateHtml(client);
html = html.replaceAll("/assets/ycb-official-letterhead.png", `file://${root}/preview/ycb-official-letterhead.png`);
html = html.replaceAll("/assets/ycb-certificate-qr.png", `file://${root}/preview/ycb-certificate-qr.png`);
const outHtml = path.join(root, "preview/ycb-certificate-message-updated.html");
const outPng = path.join(root, "preview/ycb-certificate-message-updated.png");
await fs.writeFile(outHtml, html, "utf8");
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
await page.goto(`file://${outHtml}`, { waitUntil: "networkidle" });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(outHtml);
console.log(outPng);
