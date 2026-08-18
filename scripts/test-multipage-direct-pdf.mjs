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

  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  await page.getByRole("button", { name: "Download Account Statement PDF" }).click();
  const download = await downloadPromise;
  const target = resolve(outputDir, "Account-Statement-multipage.pdf");
  await download.saveAs(target);
  console.log(JSON.stringify({ target, filename: download.suggestedFilename() }));
} finally {
  await browser.close();
}
