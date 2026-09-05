import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.goto('file:///home/ubuntu/bank-karimi-web-staging/preview/unified-print-preview.html');
await page.screenshot({ path: '/home/ubuntu/bank-karimi-web-staging/preview/unified-print-preview.png', fullPage: true });
await browser.close();
console.log('unified preview captured');
