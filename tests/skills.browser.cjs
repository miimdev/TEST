// Public rendering only: all Supabase requests mocked; no auth or production mutations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8'));
(async()=>{
  const serverless=process.env.SERVERLESS_CHROMIUM?require('@sparticuz/chromium').default:null;
  const browser=await chromium.launch(serverless?{executablePath:await serverless.executablePath(),args:serverless.args.filter(a=>a!=='--single-process'),headless:true}:{headless:true});
  try {
    let context=await browser.newContext({viewport:{width:1440,height:1100}});
    let data=structuredClone(baseline);const errors=[];
    const mock=route=>route.fulfill({json:{data,revision:11,updated_at:new Date().toISOString()}});
    await context.route('https://jmpwryddrxmuwzmbmhsb.supabase.co/**',mock);
    let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8000')+'/');
    await page.locator('.skill-card').first().waitFor();
    await page.waitForFunction(()=>!document.getElementById('loader')||document.getElementById('loader').classList.contains('is-open'));
    await page.locator('#skills-card').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.getElementById('skills-card').classList.contains('skills-in-view') && Array.from(document.querySelectorAll('.skill-card')).every(row=>Number(row.querySelector('.skill-card__arc').style.strokeDashoffset)===100-Number(row.querySelector('[data-skill-value]').dataset.skillValue)));
    assert.equal(await page.getByRole('meter').count(),baseline.skills.length);
    assert.equal(await page.getByRole('meter').first().getAttribute('aria-valuenow'),'95');
    assert.equal(await page.locator('.skill-card__value').first().textContent(),'۹۵٪');
    await page.locator('#skills-replay').click();
    await page.waitForFunction(()=>Number(document.querySelector('.skill-card__arc').style.strokeDashoffset)>5);
    await page.waitForFunction(()=>Number(document.querySelector('.skill-card__arc').style.strokeDashoffset)===5);
    await page.locator('.skill-card').first().hover({position:{x:25,y:25}});
    await page.waitForFunction(()=>document.querySelector('.skill-card').style.getPropertyValue('--skill-x')!=='');
    if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('#skills-card').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'skills-dark.png'),animations:'disabled'});}
    // Preference changes immediately settle gauges and disable decorative motion.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#skills-replay').click();
    assert.equal(await page.locator('.skill-card__value').first().textContent(),'۹۵٪');
    assert.equal(await page.locator('.skills-core__orbit').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.skill-card').first().evaluate(el=>el.style.getPropertyValue('--skill-x')),'');
    await context.close();
    context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await context.route('https://jmpwryddrxmuwzmbmhsb.supabase.co/**',mock);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8000')+'/');
    await page.locator('.skill-card').first().waitFor();
    await page.waitForFunction(()=>!document.getElementById('loader')||document.getElementById('loader').classList.contains('is-open'));
    await page.locator('#skills-card').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#skills-card').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().width<=document.documentElement.clientWidth),true);
    if(process.env.SCREENSHOT_DIR)await page.locator('#skills-card').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'skills-mobile.png'),animations:'disabled'});
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    if(process.env.SCREENSHOT_DIR)await page.locator('#skills-card').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'skills-light.png'),animations:'disabled'});
    // Simulate a real CMS broadcast: edited skills must rerender, including an already-visible panel.
    data.skills=[{name:'مهارت تازه از مدیریت',percent:67,tag:'ابزار اول · ابزار دوم'}];
    await page.evaluate(()=>{const ch=new BroadcastChannel('pf:sync');ch.postMessage('saved');ch.close();});
    await page.waitForFunction(()=>document.querySelector('.skill-card__name')?.textContent==='مهارت تازه از مدیریت');
    assert.equal(await page.getByRole('meter').count(),1);
    assert.equal(await page.locator('.skill-card__value').textContent(),'۶۷٪');
    assert.equal(await page.locator('.skill-card__tools span').count(),2);
    // Empty/large/hostile CMS values, lifecycle cleanup, no IntersectionObserver fallback.
    await page.evaluate(()=>window.MiimSkills.mount([]));
    assert.equal(await page.locator('#skills-empty').isVisible(),true);
    assert.equal(await page.locator('#skills-replay').isVisible(),false);
    await page.evaluate(()=>window.MiimSkills.mount(Array.from({length:30},(_,i)=>({name:i?'مهارت بسیار طولانی برای بررسی چیدمان موبایل':'<script>alert(1)</script>',tag:'LongToolName'.repeat(8),percent:i?100:0}))));
    assert.equal(await page.getByRole('meter').count(),30);
    assert.equal(await page.locator('#skills-card').getAttribute('data-cinematic'),null);
    assert.equal(await page.locator('#skills-card').evaluate(el=>getComputedStyle(el).opacity),'1');
    assert.equal(await page.locator('#skills-list script').count(),0);
    assert.equal(await page.locator('#skills-card').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().width<=document.documentElement.clientWidth),true);
    await page.evaluate(()=>{const io=window.IntersectionObserver;delete window.IntersectionObserver;window.MiimSkills.mount([{name:'بدون Observer',percent:42,tag:''}]);window.IntersectionObserver=io;});
    assert.equal(await page.locator('.skill-card__value').textContent(),'۴۲٪');
    assert.deepEqual(errors,[]);
    console.log('PASS: skill meters, reveal/replay animation, pointer spotlight, reduced motion, desktop/mobile/light layouts, CMS live rerender, empty/30/hostile content and observer fallback.');
    await context.close();
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
