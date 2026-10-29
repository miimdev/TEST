// Mocked API integration tests: no production auth users, emails or writes are created.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.json'), 'utf8'));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
(async () => {
  const serverless = process.env.SERVERLESS_CHROMIUM ? require('@sparticuz/chromium').default : null;
  const browser = await chromium.launch(serverless ? { executablePath: await serverless.executablePath(), args: serverless.args.filter(a => a !== '--single-process'), headless: true } : { headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let row = { data: structuredClone(snapshot), revision: 2, updated_at: new Date().toISOString() };
    let failWrite = false;
    let allowAdmin = true;
    let password = 'cloud-test-password';
    let activation = false;
    let recovered = false;
    const id = randomUUID();
    const user = { id, aud: 'authenticated', role: 'authenticated', email: 'resane.miim@gmail.com', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: id, email: user.email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test';
    const session = () => ({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-refresh', user });
    await context.route('https://jmpwryddrxmuwzmbmhsb.supabase.co/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const body = request.postDataJSON();
      const send = (json, status = 200) => route.fulfill({ status, json });
      if (url.pathname === '/auth/v1/token') {
        if (['refresh_token', 'pkce'].includes(url.searchParams.get('grant_type'))) return send(session());
        return body.password === password ? send(session()) : send({ msg: 'Invalid login credentials', error_code: 'invalid_credentials' }, 400);
      }
      if (url.pathname === '/auth/v1/user') {
        if (request.method() === 'PUT') password = body.password;
        return send(user);
      }
      if (url.pathname === '/auth/v1/signup') { activation = true; return send({ user, session: null }); }
      if (url.pathname === '/auth/v1/recover') { recovered = true; return send({}); }
      if (url.pathname === '/auth/v1/logout') return send({});
      if (url.pathname === '/rest/v1/rpc/miim_is_admin') return send(allowAdmin);
      if (url.pathname === '/rest/v1/miim_content') {
        if (request.method() === 'PATCH') {
          if (failWrite) return send({ message: 'permission denied', code: '42501' }, 403);
          if (url.searchParams.get('revision') !== 'eq.' + row.revision) return send(null);
          row = { data: { ...body.data, updatedAt: new Date().toISOString() }, revision: row.revision + 1, updated_at: new Date().toISOString() };
        }
        return send(row);
      }
      throw new Error('Unexpected mock request ' + request.url());
    });
    await page.goto(base + '/admin/');
    await page.locator('#username').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'login-desktop.png'), fullPage: true });
    await page.locator('#username').fill(user.email);
    await page.locator('#password').fill('wrong-password');
    await page.locator('#login-submit').click();
    await page.waitForFunction(() => document.getElementById('login-error').dataset.error === 'true');
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    await page.locator('#activate-mode').click();
    await page.locator('#password').fill(password);
    await page.locator('#login-submit').click();
    await page.waitForFunction(() => !document.getElementById('login-submit').disabled);
    assert.equal(activation, true);
    await page.locator('#activate-mode').click();
    await page.locator('#forgot-password').click();
    await page.waitForFunction(() => !document.getElementById('forgot-password').disabled);
    assert.equal(recovered, true);
    await page.locator('#password').fill(password);
    await page.locator('#toggle-password').click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.locator('#login-submit').click();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    await page.reload();
    await page.locator('#dashboard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.work-editor').count(), 4);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'dashboard-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'dashboard-mobile.png'), fullPage: true });
    await page.locator('.work-editor [data-key=title]').first().fill('عنوان آزمایشی سایت');
    await page.locator('#publish').click();
    await page.waitForFunction(() => !document.getElementById('publish').disabled);
    assert.equal(row.data.works[0].title, 'عنوان آزمایشی سایت');
    assert.equal(row.data.works[0].url, snapshot.works[0].url);
    assert.ok(row.data.identity.heroTitle);
    assert.ok(row.data.contact.formspree);
    assert.equal(row.data.skills[0].tag, 'Figma');
    assert.equal('authHash' in row.data, false);
    // Failed requests retain the draft and cannot show a successful publish.
    failWrite = true;
    await page.locator('.work-editor [data-key=title]').first().fill('پیش‌نویس ذخیره‌نشده');
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.getElementById('save-status').dataset.error === 'true');
    assert.equal(row.data.works[0].title, 'عنوان آزمایشی سایت');
    assert.match(await page.locator('#draft-state').textContent(), /منتشرنشده/);
    failWrite = false;
    // Conflict: a second editor has saved since the last read.
    row.revision += 1;
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('نسخهٔ جدیدتری'));
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#refresh-content').click();
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('آخرین نسخه'));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const output = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(output.works[0].title, row.data.works[0].title);
    // Cloud, not an old local draft, drives the public website.
    const home = await context.newPage();
    await home.goto(base + '/');
    await home.waitForFunction(() => document.getElementById('stage-active-title').textContent === 'عنوان آزمایشی سایت');
    await home.close();
    await page.locator('#current-password').fill(password);
    await page.locator('#new-password').fill('updated-cloud-password');
    await page.locator('#confirm-password').fill('updated-cloud-password');
    await page.locator('#credentials-form button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('credentials-status').textContent.includes('به‌روزرسانی شد'));
    assert.equal(password, 'updated-cloud-password');
    await page.locator('#logout').click();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'login-mobile.png'), fullPage: true });
    // A valid Supabase user is not necessarily an authorized studio admin.
    allowAdmin = false;
    await page.locator('#username').fill(user.email);
    await page.locator('#password').fill(password);
    await page.locator('#login-submit').click();
    await page.waitForFunction(() => document.getElementById('login-error').textContent.includes('اجازهٔ مدیریت'));
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    allowAdmin = true;
    const recoveryPage = await context.newPage();
    await recoveryPage.addInitScript(() => {
      localStorage.removeItem('miim:cloud-auth');
      localStorage.setItem('miim:cloud-auth-code-verifier', JSON.stringify('test-verifier-for-mocked-callback/recovery'));
    });
    await recoveryPage.goto(base + '/admin/?code=mock-recovery-code');
    await recoveryPage.locator('#recovery-view').waitFor({ state: 'visible' });
    await recoveryPage.locator('#recovery-password').fill('recovered-test-password');
    await recoveryPage.locator('#recovery-confirm').fill('recovered-test-password');
    await recoveryPage.locator('#recovery-form button').click();
    await recoveryPage.locator('#dashboard').waitFor({ state: 'visible' });
    assert.equal(password, 'recovered-test-password');
    await recoveryPage.close();
    assert.deepEqual(errors, []);
    console.log('PASS: graphic desktop/mobile layouts; activation/recovery requests; invalid/valid auth; server authorization; restored session; publish/failure/conflict; export; cloud homepage; password change and logout (mock Supabase API).');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
