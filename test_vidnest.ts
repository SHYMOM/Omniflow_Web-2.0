import { chromium } from 'playwright';

(async () => {
  console.log('Testing Vidnest...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let m3u8 = '';
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('.m3u8')) {
      console.log('Found m3u8:', url);
      m3u8 = url;
    }
  });

  try {
    await page.goto('https://vidnest.fun/movie/550', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000); // Wait for network requests
  } catch (e) {
    console.error(e);
  }
  
  await browser.close();
  console.log('Final M3U8:', m3u8 || 'Not found');
})();
