const {test}=require('node:test');
const assert=require('node:assert/strict');
const skills=require('../skills.js');
test('skill meters clamp and normalize values without NaN or overflow',()=>{
  for(const [input,expected] of [[95.8,96],[-5,0],[1000,100],['90',90],['bad',0],[Infinity,0]])assert.equal(skills.percent(input),expected);
});
test('skills renderer escapes names and tools and exposes labelled accessible meters',()=>{
  const html=skills.markup([{name:'<img src=x onerror=alert(1)>',tag:'HTML · CSS · <script>',percent:88}]);
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));
  assert.match(html,/&lt;img/);assert.match(html,/aria-valuenow="88"/);assert.match(html,/aria-labelledby="skill-name-0"/);assert.match(html,/pathLength="100"/);assert.match(html,/stroke-dashoffset="12"/);
  assert.match(html,/۸۸/);assert.equal((html.match(/<span dir="auto">/g)||[]).length,3);
});
test('skill families use tags/names with a generic design fallback, not fixed array positions',()=>{
  for(const [name,expected] of [['CSS','code'],['After Effects','motion'],['Illustrator','brand'],['Figma','design'],['مهارت جدید','design']])assert.equal(skills.kind({name}),expected);
  assert.equal(skills.markup([]),'');
  const html=skills.markup(Array.from({length:30},(_,i)=>({name:'مهارت '+i,percent:50})));
  assert.equal((html.match(/role="meter"/g)||[]).length,30);assert.ok(!html.includes('--skill-index:29'));
});
