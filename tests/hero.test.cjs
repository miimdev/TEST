const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const hero=require('../hero.js');
test('poster pointer light positions stay within flat percentage bounds',()=>{
  for(const [value,expected] of [[-2,0],[120,100],[42,42],['bad',0]])assert.equal(hero.clamp(value),expected);
  assert.equal('project' in hero,false);
});
test('hero keeps original portrait, CMS bindings and motion controls without 3D artwork',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const id of ['hero-stage','hero-photo','portrait-poster','hero-replay','hero-motion-toggle','availability-pill','badge-logo','hero-title'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/src="Image\/My-photo.png"/);assert.ok(!html.includes('reactor-prism'));assert.ok(!html.includes('hero-reactor-canvas'));
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8').split('/* Flat editorial portrait.')[1].split('/* نوار آمار هیرو */')[0];
  assert.doesNotMatch(css,/perspective:|rotateX\(|rotateY\(|translateZ\(|preserve-3d/);
});
