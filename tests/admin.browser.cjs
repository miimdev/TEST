// Optional browser check: install playwright + a Chromium browser outside the repo.
// NODE_PATH=<dependency-directory>/node_modules node tests/admin.browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const serverless = process.env.SERVERLESS_CHROMIUM ? require('@sparticuz/chromium').default : null;
  const browser = await chromium.launch(serverless ? {
    executablePath: await serverless.executablePath(), args: serverless.args, headless: true,
  } : { headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
    await page.goto(base + '/admin/');
    await page.locator('#username').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    await page.evaluate(() => PF.setCredentials('browser-admin', 'test-password'));
    await page.locator('#username').fill('browser-admin');
    await page.locator('#password').fill('wrong-password');
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('login-error').textContent.length > 0);
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    await page.locator('#password').fill('test-password');
    await page.locator('#toggle-password').click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.reload();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.work-editor').count(), 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.work-editor [data-key=title]').first().fill('عنوان آزمایشی سایت');
    await page.locator('#editor button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('ذخیره شد'));
    const saved = await page.evaluate(() => PF.readLocal());
    assert.equal(saved.works[0].title, 'عنوان آزمایشی سایت');
    assert.equal(saved.works[0].url, 'https://miimdev.github.io/STYLE-LAND/');
    assert.ok(saved.identity.heroTitle);
    assert.ok(saved.contact.formspree);
    assert.equal(saved.skills[0].tag, 'Figma');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const output = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(output.works[0].title, saved.works[0].title);
    assert.equal(output.works[2].url, 'https://miimdev.github.io/IDEA/');
    const home = await context.newPage();
    await home.goto(base + '/');
    await home.waitForFunction(() => document.getElementById('stage-active-title').textContent === 'عنوان آزمایشی سایت');
    await home.close();
    await page.locator('#new-username').fill('updated-admin');
    await page.locator('#new-password').fill('updated-password');
    await page.locator('#confirm-password').fill('updated-password');
    await page.locator('#credentials-form button[type=submit]').click();
    await page.locator('#editor button[type=submit]').click();
    await page.locator('#logout').click();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    await page.locator('#username').fill('updated-admin');
    await page.locator('#password').fill('updated-password');
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.evaluate(() => localStorage.setItem('pf:auth', String(Date.now() - 1)));
    await page.locator('#editor button[type=submit]').click();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    assert.match(await page.locator('#login-error').textContent(), /نشست/);
    assert.deepEqual(errors, []);

    const offlineContext = await browser.newContext();
    await offlineContext.addInitScript(() => { try { localStorage.clear(); } catch {} });
    const offline = await offlineContext.newPage();
    await offline.route('**/data.json', route => route.abort());
    await offline.goto(base + '/admin/');
    await offline.locator('#retry').waitFor({ state: 'visible' });
    assert.equal(await offline.locator('#dashboard').isVisible(), false);
    await offline.unroute('**/data.json');
    await offline.locator('#retry').click();
    await offline.locator('#login-view').waitFor({ state: 'visible' });
    console.log('PASS: mobile layout, invalid/valid login, session restore/expiry, save, metadata, export, main-site integration, password change, logout, data failure/retry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
