import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const outputDir = resolve(import.meta.dirname, "..", "tmp-direct-download-test");
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const diagnostics = [];
  page.on("console", (message) => diagnostics.push(`console ${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  await page.goto("http://127.0.0.1:3000/?tab=review", { waitUntil: "networkidle" });

  const statusDownload = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await page.getByRole("button", { name: "Download Account Status PDF" }).click();
  const status = await statusDownload;
  if (!status) {
    const body = await page.locator("body").textContent();
    throw new Error(JSON.stringify({ reason: "Account status PDF did not trigger a download.", body, diagnostics }));
  }
  await status.saveAs(resolve(outputDir, status.suggestedFilename()));

  const statementDownload = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await page.getByRole("button", { name: "Download Account Statement PDF" }).click();
  const statement = await statementDownload;
  if (!statement) {
    const body = await page.locator("body").textContent();
    throw new Error(JSON.stringify({ reason: "Account statement PDF did not trigger a download.", body, diagnostics }));
  }
  await statement.saveAs(resolve(outputDir, statement.suggestedFilename()));

  console.log(JSON.stringify({
    outputDir,
    status: status.suggestedFilename(),
    statement: statement.suggestedFilename(),
  }));
} finally {
  await browser.close();
}
