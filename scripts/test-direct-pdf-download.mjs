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

async function capturePdf(page, buttonName, expectedTitle, fileName) {
  const popupPromise = page.waitForEvent("popup", { timeout: 15_000 });
  await page.getByRole("button", { name: buttonName }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("load");
  await popup.evaluate(() => document.fonts?.ready);
  const title = await popup.title();
  const pageCount = await popup.locator(".page").count();
  if (title !== expectedTitle || pageCount < 1) {
    throw new Error(JSON.stringify({ buttonName, title, pageCount }));
  }
  await popup.pdf({
    path: resolve(outputDir, fileName),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await popup.close();
  return { title, pageCount };
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const diagnostics = [];
  page.on("console", (message) => diagnostics.push(`console ${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  await page.goto("http://127.0.0.1:3000/?tab=review", { waitUntil: "networkidle" });

  const status = await capturePdf(page, "Print / Save Account Status PDF", "Account Status Statement", "account-status-native.pdf");
  const statement = await capturePdf(page, "Print / Save Account Statement PDF", "Account Statement", "account-statement-native.pdf");

  console.log(JSON.stringify({ outputDir, status, statement, diagnostics }));
} finally {
  await browser.close();
}
