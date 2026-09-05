import { chromium } from 'playwright-core';
const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/chromium'});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('file:///home/ubuntu/bank-karimi-web-staging/preview/mockup.html');
await page.locator('.login').screenshot({ path: '/home/ubuntu/bank-karimi-web-staging/preview/login-preview.png' });
await page.locator('.workspace').screenshot({ path: '/home/ubuntu/bank-karimi-web-staging/preview/workspace-preview.png' });
await page.screenshot({ path: '/home/ubuntu/bank-karimi-web-staging/preview/combined-preview.png', fullPage: true });
await browser.close();
console.log('captured');
