import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless:true, executablePath:'/usr/bin/chromium' });
const page = await browser.newPage({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 });
await page.goto('file:///home/ubuntu/bank-karimi-web-staging/preview/password-login.html');
await page.locator('.login').screenshot({ path:'/home/ubuntu/bank-karimi-web-staging/preview/password-login-preview.png' });
await page.evaluate(() => document.body.className = 'showportal');
await page.locator('.portal').screenshot({ path:'/home/ubuntu/bank-karimi-web-staging/preview/portal-preview.png' });
await browser.close();
console.log('password previews captured');
