// Mocked public content. No real orders, notifications or production mutations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8'));
(async()=>{
 const serverless=process.env.SERVERLESS_CHROMIUM?require('@sparticuz/chromium').default:null;
 const browser=await chromium.launch(serverless?{executablePath:await serverless.executablePath(),args:serverless.args.filter(a=>a!=='--single-process'),headless:true}:{headless:true});
 try{
  let data=structuredClone(baseline);const errors=[];
  async function create(options={}){
   const context=await browser.newContext(options);
   await context.route('https://jmpwryddrxmuwzmbmhsb.supabase.co/**',route=>route.fulfill({json:{data,revision:11,updated_at:new Date().toISOString()}}));
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8000')+'/');
   await page.locator('#loader').waitFor({state:'detached'});
   await page.locator('#hero-stage').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.getElementById('hero-photo').complete&&document.getElementById('hero-photo').naturalWidth>0);
   return {context,page};
  }
  const {context,page}=await create({viewport:{width:1440,height:1080}});
  await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.posterState==='running');
  assert.equal(await page.locator('#hero-photo').getAttribute('src'),'Image/My-photo.png');
  assert.match(await page.locator('#hero-photo').getAttribute('alt'),/مجتبی/);
  assert.equal(await page.locator('#hero-stage canvas').count(),0);
  assert.equal(await page.locator('.reactor-prism').count(),0);
  // The entrance must be visible AFTER the global loader, not spent behind it.
  await page.waitForFunction(()=>document.getElementById('hero-stage').classList.contains('is-poster-entering'));
  await page.locator('#hero-replay').click();
  await page.waitForFunction(()=>document.getElementById('hero-stage').classList.contains('is-poster-entering'));
  const sequence=await page.evaluate(()=>{
    const stage=document.getElementById('hero-stage');
    const animations=stage.getAnimations({subtree:true});
    const photo=animations.find(a=>a.animationName==='poster-photo-enter');
    const name=animations.find(a=>a.animationName==='poster-name-enter'&&a.effect.target.tagName==='STRONG');
    const sample=time=>{photo.currentTime=time;return getComputedStyle(photo.effect.target).clipPath;};
    return {early:sample(350),late:sample(1600),photoDelay:photo.effect.getTiming().delay,nameDelay:name.effect.getTiming().delay,names:animations.map(a=>a.animationName)};
  });
  assert.notEqual(sequence.early,sequence.late);
  assert.ok(sequence.photoDelay<sequence.nameDelay);
  for(const name of ['poster-paper-enter','poster-type-enter','poster-rule-enter','poster-signature-enter','poster-intro-light','poster-stamp-enter'])assert.ok(sequence.names.includes(name),name);
  // A second replay must reset the animation rather than retaining the old time.
  await page.locator('#hero-replay').click();
  await page.waitForFunction(()=>{
    const animation=document.getElementById('hero-stage').getAnimations({subtree:true}).find(a=>a.animationName==='poster-photo-enter');
    return animation&&animation.currentTime<300;
  });
  await page.waitForFunction(()=>!document.getElementById('hero-stage').classList.contains('is-poster-entering'));
  await page.locator('#portrait-poster').hover({position:{x:60,y:90}});
  await page.waitForFunction(()=>document.getElementById('portrait-poster').style.getPropertyValue('--poster-light-x')!=='');
  assert.equal(await page.locator('#hero-photo').evaluate(el=>getComputedStyle(el).transform),'none');
  await page.locator('#hero-motion-toggle').click();
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'paused');
  assert.equal(await page.locator('#hero-replay').isDisabled(),true);
  assert.equal(await page.locator('.poster-ink').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
  assert.equal(await page.locator('.poster-photo-wrap').evaluate(el=>getComputedStyle(el,'::before').animationPlayState),'paused');
  assert.equal(await page.locator('.poster-rule').first().evaluate(el=>getComputedStyle(el,'::after').animationPlayState),'paused');
  await page.reload();await page.locator('#loader').waitFor({state:'detached'});
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'paused');
  await page.locator('#hero-motion-toggle').click();
  await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.posterState==='running');
  if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'portrait-desktop.png')});}
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.posterState==='offscreen');
  await page.locator('#hero-stage').scrollIntoViewIfNeeded();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.posterState==='reduced');
  assert.equal(await page.locator('#hero-motion-toggle').isDisabled(),true);
  assert.equal(await page.locator('.poster-ink').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.poster-photo-wrap').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
  assert.equal(await page.locator('.poster-rule').first().evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'portrait-light.png')});
  data.identity.photo='proj-1.jpg';data.identity.name='نام جدید مدیر';
  await page.evaluate(()=>{const ch=new BroadcastChannel('pf:sync');ch.postMessage('saved');ch.close();});
  await page.waitForFunction(()=>document.getElementById('hero-photo').getAttribute('src')==='Image/proj-1.jpg');
  assert.match(await page.locator('#hero-photo').getAttribute('alt'),/نام جدید/);
  assert.equal(await page.locator('#poster-name').textContent(),'نام جدید مدیر');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'hidden');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));window.MiimHero.stop();});
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'stopped');
  await page.locator('#hero-motion-toggle').click();
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'stopped');
  await page.evaluate(()=>{window.MiimHero.start();window.MiimHero.start();});
  await page.waitForFunction(()=>document.getElementById('hero-stage').dataset.posterState==='running');
  await page.locator('#hero-motion-toggle').click();
  assert.equal(await page.locator('#hero-stage').getAttribute('data-poster-state'),'paused');
  await context.close();data=structuredClone(baseline);
  const mobile=await create({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  assert.equal(await mobile.page.locator('#hero-stage').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().width<=document.documentElement.clientWidth),true);
  assert.equal(await mobile.page.locator('#hero-photo').isVisible(),true);
  assert.equal(await mobile.page.locator('#portrait-poster').evaluate(el=>getComputedStyle(el).perspective),'none');
  if(process.env.SCREENSHOT_DIR)await mobile.page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'portrait-mobile.png')});
  await mobile.page.locator('.hero__actions a[href="#contact"]').click();
  await mobile.page.waitForFunction(()=>location.hash==='#contact');
  await mobile.context.close();assert.deepEqual(errors,[]);
  console.log('PASS: original portrait, flat graphics/no 3D, post-loader staged choreography/rapid replay, paused/reduced-motion light trails, light-only pointer response, pause persistence, offscreen/reduced motion, CMS photo/name updates, lifecycle, mobile/light and CTA.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
