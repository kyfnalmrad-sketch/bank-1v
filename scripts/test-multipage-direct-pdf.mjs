import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { chromium } from "playwright-core";

const outputDir = resolve(import.meta.dirname, "..", "tmp-direct-download-test");
mkdirSync(outputDir, { recursive: true });
const rows = [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]];
for (let index = 1; index <= 21; index += 1) {
  const day = String(index).padStart(2, "0");
  rows.push([`2026-08-${day}`, index % 3 === 0 ? "Cash withdrawal at ATM" : "Cash deposit at HADDAH branch", `REF-${index}`, index % 3 === 0 ? 25 : "", index % 3 === 0 ? "" : 100, 100 * index - 25 * Math.floor(index / 3)]);
}
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Ledger");
const workbookBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://127.0.0.1:3000/?tab=transactions", { waitUntil: "networkidle" });
  await page.locator("input[type='file']").setInputFiles({ name: "multi-page-ledger.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBuffer });
  await page.getByText("Editable Transaction Register").waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Review & Export" }).click();
  await page.getByText("Current estimate: 2 statement page(s).").waitFor({ timeout: 10_000 });

  const popupPromise = page.waitForEvent("popup", { timeout: 15_000 });
  await page.getByRole("button", { name: "Print / Save Account Statement PDF" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("load");
  await popup.evaluate(() => document.fonts?.ready);
  const pageCount = await popup.locator(".page").count();
  const operationCount = await popup.locator("[data-operation]").count();
  const firstPageOperationCount = await popup.locator(".page").nth(0).locator("[data-operation]").count();
  const secondPageOperationCount = await popup.locator(".page").nth(1).locator("[data-operation]").count();
  const firstPageText = await popup.locator(".page").nth(0).textContent();
  const lastPageText = await popup.locator(".page").nth(1).textContent();
  const finalText = await popup.locator("body").textContent();
  const firstPageHasFinalNotice = firstPageText?.includes("Please review this statement") || firstPageText?.includes("END OF REPORT");
  const lastPageHasFinalNotice = lastPageText?.includes("Please review this statement") && lastPageText.includes("END OF REPORT");
  if (pageCount !== 2 || operationCount !== 21 || firstPageOperationCount !== 19 || secondPageOperationCount !== 2 || firstPageHasFinalNotice || !lastPageHasFinalNotice || !finalText?.includes("END OF REPORT")) {
    throw new Error(JSON.stringify({ pageCount, operationCount, firstPageOperationCount, secondPageOperationCount, firstPageHasFinalNotice, lastPageHasFinalNotice }));
  }
  await popup.pdf({
    path: resolve(outputDir, "Account-Statement-multipage-native.pdf"),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  console.log(JSON.stringify({ target: resolve(outputDir, "Account-Statement-multipage-native.pdf"), pageCount, operationCount, firstPageOperationCount, secondPageOperationCount, firstPageHasFinalNotice, lastPageHasFinalNotice, nativePrint: true }));
  await popup.close();
} finally {
  await browser.close();
}
