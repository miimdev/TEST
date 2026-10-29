// Uses mocked content only. Does not send orders, notifications or mutate production data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8'));
(async()=>{
  const serverless=process.env.SERVERLESS_CHROMIUM?require('@sparticuz/chromium').default:null;
  const browser=await chromium.launch(serverless?{executablePath:await serverless.executablePath(),args:serverless.args.filter(a=>a!=='--single-process'),headless:true}:{headless:true});
  try {
    const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000';
    const errors=[];
    async function create(options={},noCanvas=false){
      const context=await browser.newContext(options);
      await context.route('https://jmpwryddrxmuwzmbmhsb.supabase.co/**',route=>route.fulfill({json:{data,revision:11,updated_at:new Date().toISOString()}}));
      if(noCanvas)await context.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/');
      await page.waitForFunction(()=>document.documentElement.classList.contains('is-ready'));
      await page.locator('#loader').waitFor({state:'detached'});
      await page.locator('#hero-stage').scrollIntoViewIfNeeded();
      return {context,page};
    }
    const {context,page}=await create({viewport:{width:1440,height:1080}});
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='running');
    assert.equal(await page.locator('#hero-photo').count(),0);
    assert.match(await page.locator('#hero-title').textContent(),/خلق/);
    const canvas=page.locator('#hero-reactor-canvas');
    const initial=await canvas.evaluate(el=>el.toDataURL());
    await page.waitForFunction(initial=>document.getElementById('hero-reactor-canvas').toDataURL()!==initial,initial);
    await page.locator('.reactor-art').hover({position:{x:40,y:40}});
    await page.waitForFunction(()=>document.getElementById('reactor-space').style.getPropertyValue('--reactor-ry')!=='');
    await page.locator('#hero-spark').click();
    await page.waitForFunction(()=>document.getElementById('hero-stage').classList.contains('is-reactor-spark'));
    await page.locator('#hero-motion-toggle').click();
    assert.equal(await page.locator('#hero-stage').getAttribute('data-reactor-state'),'paused');
    assert.equal(await page.locator('#hero-motion-toggle').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#hero-spark').isDisabled(),true);
    assert.equal(await page.locator('.reactor-axis').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
    const paused=await canvas.evaluate(el=>el.toDataURL());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await canvas.evaluate(el=>el.toDataURL()),paused);
    await page.reload();await page.waitForFunction(()=>document.documentElement.classList.contains('is-ready'));
      await page.locator('#loader').waitFor({state:'detached'});
    assert.equal(await page.locator('#hero-stage').getAttribute('data-reactor-state'),'paused');
    await page.locator('#hero-motion-toggle').click();
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='running');
    if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'hero-desktop.png')});}
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='offscreen');
    await page.locator('#hero-stage').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='running');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='reduced');
    assert.equal(await page.locator('#hero-motion-toggle').isDisabled(),true);
    assert.equal(await page.locator('.reactor-axis').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('#reactor-space').evaluate(el=>el.style.getPropertyValue('--reactor-ry')),'');
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'hero-light.png')});
    // Reinitialization is safe: one toggle click must still change state exactly once.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{window.MiimHero.start();window.MiimHero.start();});
    await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.reactorState==='running');
    await page.locator('#hero-motion-toggle').click();
    assert.equal(await page.locator('#hero-stage').getAttribute('data-reactor-state'),'paused');
    await context.close();
    const mobile=await create({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    assert.equal(await mobile.page.locator('#hero-stage').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().width<=document.documentElement.clientWidth),true);
    assert.equal(await mobile.page.locator('#hero-reactor-canvas').evaluate(el=>el.width<=Math.ceil(el.getBoundingClientRect().width)),true);
    assert.equal(await mobile.page.locator('.hero__copy').evaluate(el=>el.getBoundingClientRect().top<document.getElementById('hero-stage').getBoundingClientRect().top),true);
    if(process.env.SCREENSHOT_DIR)await mobile.page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'hero-mobile.png'),fullPage:false});
    await mobile.page.locator('.hero__actions a[href="#contact"]').click();
    await mobile.page.waitForFunction(()=>location.hash==='#contact');
    await mobile.context.close();
    const fallback=await create({viewport:{width:1024,height:1000},reducedMotion:'reduce'},true);
    assert.equal(await fallback.page.locator('.reactor-face--front').isVisible(),true);
    assert.equal(await fallback.page.locator('#hero-motion-toggle').isDisabled(),true);
    await fallback.context.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: motion hero canvas/parallax/spark, pause and persistence, offscreen suspension, reduced motion changes, reinit cleanup, mobile layout/CTA, light theme and no-canvas fallback.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
