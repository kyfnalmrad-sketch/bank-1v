import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { chromium } from "playwright-core";

const outputDir = resolve(import.meta.dirname, "..", "tmp-print-window-test");
mkdirSync(outputDir, { recursive: true });

const rows = [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]];
for (let index = 1; index <= 21; index += 1) {
  const day = String(index).padStart(2, "0");
  rows.push([`2026-08-${day}`, "Cash deposit at HADDAH branch", `PRINT-${index}`, "", 100, index * 100]);
}
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Ledger");
const workbookBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printInvoked = "true"; };
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/?tab=transactions", { waitUntil: "networkidle" });
  await page.locator("input[type='file']").setInputFiles({ name: "print-window-ledger.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBuffer });
  await page.getByText("Editable Transaction Register").waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Review & Export" }).click();
  await page.getByText("Current estimate: 2 statement page(s).").waitFor({ timeout: 10_000 });

  const statusPopupPromise = page.waitForEvent("popup", { timeout: 15_000 });
  await page.getByRole("button", { name: "Print Account Status / Save PDF" }).click();
  const statusPopup = await statusPopupPromise;
  await statusPopup.waitForFunction(() => document.documentElement.dataset.printInvoked === "true", undefined, { timeout: 20_000 });
  const statusHtml = await statusPopup.content();
  if (!statusHtml.includes("print-asset-preservation") || !statusHtml.includes("kuraimi")) throw new Error("Account status print popup is missing document assets.");
  await statusPopup.pdf({ path: resolve(outputDir, "account-status-print-window.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });

  const statementPopupPromise = page.waitForEvent("popup", { timeout: 15_000 });
  await page.getByRole("button", { name: "Print Account Statement / Save PDF" }).click();
  const statementPopup = await statementPopupPromise;
  await statementPopup.waitForFunction(() => document.documentElement.dataset.printInvoked === "true", undefined, { timeout: 20_000 });
  const statementHtml = await statementPopup.content();
  const pageCount = (statementHtml.match(/class="page"/g) || []).length;
  if (pageCount !== 2 || !statementHtml.includes("END OF REPORT")) throw new Error(`Expected two statement print pages; received ${pageCount}.`);
  await statementPopup.pdf({ path: resolve(outputDir, "account-statement-print-window.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });

  console.log(JSON.stringify({ outputDir, statusPopup: true, statementPages: pageCount }));
} finally {
  await browser.close();
}
