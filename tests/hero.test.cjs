const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const hero=require('../hero.js');
test('hero projection stays finite for its bounded sphere and viewport sizes',()=>{
  for(const width of [280,390,600])for(let i=0;i<20;i++){
    const t=i*Math.PI/10,p=hero.project(Math.cos(t),Math.sin(t),Math.sin(t)*.5,t,100,width,400);
    for(const key of ['x','y','depth','scale'])assert.ok(Number.isFinite(p[key]));
    assert.ok(p.scale>0);
  }
  assert.equal(hero.clamp(-2,-1,1),-1);assert.equal(hero.clamp(5,-1,1),1);
});
test('public hero replaces the portrait, preserves CMS bindings and exposes real motion controls',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(!html.includes('id="hero-photo"'));assert.ok(!html.includes('Image/My-photo.png'));
  for(const id of ['hero-stage','hero-reactor-canvas','hero-motion-toggle','hero-spark','availability-pill','badge-logo','hero-title'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/aria-pressed="false"/);assert.match(html,/class="reactor-art" aria-hidden="true"/);
});
