import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("https://bank-karimi-web-staging.onrender.com/", { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForTimeout(1_500);
  const result = await page.locator(".reference-logo").evaluate((image) => {
    const element = image;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      src: element.getAttribute("src"),
      currentSrc: element.currentSrc,
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
    };
  });
  console.log(JSON.stringify({ result, consoleErrors }));
} finally {
  await browser.close();
}
