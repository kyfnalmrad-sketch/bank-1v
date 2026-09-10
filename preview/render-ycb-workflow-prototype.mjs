import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await page.goto("file:///home/ubuntu/bank-karimi-web-staging/preview/ycb-workflow-prototype.html");
await page.screenshot({ path: "/home/ubuntu/bank-karimi-web-staging/preview/ycb-workflow-prototype.png", fullPage: true });
await page.pdf({ path: "/home/ubuntu/bank-karimi-web-staging/preview/ycb-workflow-prototype.pdf", format: "A4", landscape: true, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
await browser.close();
console.log("YCB workflow preview rendered");
