import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const baseUrl = "https://bank-karimi-web-staging.onrender.com/?tab=review&preview=";
const screenshotDir = "/home/ubuntu/render-verification";
mkdirSync(screenshotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = {};

  for (const preview of ["accountStatus", "accountStatement"]) {
    await page.goto(`${baseUrl}${preview}`, { waitUntil: "networkidle", timeout: 45_000 });
    const frame = page.frameLocator("iframe.document-frame");
    await frame.locator(".page").waitFor({ timeout: 25_000 });
    await frame.locator("img").evaluateAll(images => Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => image.addEventListener("load", resolve, { once: true }));
    })));
    results[preview] = await frame.locator(".page").evaluate((pageElement) => {
      const backgroundImage = getComputedStyle(pageElement).backgroundImage;
      const images = Array.from(document.images).map(image => ({
        alt: image.alt,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
      }));
      return { backgroundImage, images };
    });
    await frame.locator(".page").screenshot({ path: `${screenshotDir}/${preview}-iframe.png` });
  }

  const status = results.accountStatus;
  const statement = results.accountStatement;
  if (!status.backgroundImage.includes("kuraimi-statement-page-background") || !status.images.some(image => image.alt === "Verification QR" && image.naturalWidth > 0)) {
    throw new Error("Account status assets did not load in Render iframe.");
  }
  if (!statement.images.some(image => image.alt === "Original statement header" && image.naturalWidth > 0) || !statement.images.some(image => image.alt === "Verification QR" && image.naturalWidth > 0)) {
    throw new Error("Account statement header or QR did not load in Render iframe.");
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
