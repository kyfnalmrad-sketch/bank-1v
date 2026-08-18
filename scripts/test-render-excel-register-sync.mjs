import { chromium } from "playwright-core";

const excelPath = "/home/ubuntu/upload/badr_rashed_training_ledger_varied_refno.xlsx";
const revisedDescription = "Cash deposit at HADDAH branch";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("https://bank-karimi-web-staging.onrender.com/?tab=transactions", { waitUntil: "networkidle", timeout: 45_000 });
  await page.locator("input[type='file']").setInputFiles(excelPath);
  await page.getByText("Editable Transaction Register").waitFor({ timeout: 25_000 });

  const descriptionInput = page.locator(".description-cell input").first();
  const before = await descriptionInput.inputValue();
  await descriptionInput.fill(revisedDescription);
  const applyButton = page.getByRole("button", { name: "Apply Register Changes" });
  await applyButton.waitFor({ state: "visible", timeout: 10_000 });
  await applyButton.click();
  await page.getByRole("button", { name: "Register Applied" }).waitFor({ timeout: 10_000 });

  await page.getByRole("button", { name: "Review & Export" }).click();
  await page.getByRole("button", { name: "View Account Statement" }).click();
  const frame = page.frameLocator("iframe.document-frame");
  await frame.getByText(revisedDescription).waitFor({ timeout: 20_000 });

  console.log(JSON.stringify({ importedFile: excelPath.split("/").at(-1), before, revisedDescription, registerApplied: true, statementSynced: true }));
} finally {
  await browser.close();
}
