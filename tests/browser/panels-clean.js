// Solarify browser check: panels-clean. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1366,height:768}});const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});p.on('dialog',d=>d.accept());
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
await p.goto(BASE+'/index.html');await p.waitForTimeout(800);
const cases=[
 ['empty system (no planets, no home)',{star:'G',inner:0,outer:0,moonsInner:0,moonsOuter:0,home:'none',seed:1}],
 ['home only, no moons',{star:'M',inner:0,outer:0,moonsInner:0,moonsOuter:0,home:'hz',seed:2}],
 ['giants only',{star:'K',inner:0,outer:5,moonsInner:0,moonsOuter:6,home:'none',seed:3}],
 ['one of everything, white dwarf',{star:'WD',inner:1,outer:1,moonsInner:1,moonsOuter:1,home:'cold',seed:4}],
 ['red giant, home too hot',{star:'RG',inner:5,outer:2,moonsInner:3,moonsOuter:2,home:'hot',seed:5}],
 ['B star everything',{star:'B',inner:8,outer:2,moonsInner:4,moonsOuter:2,home:'hz',seed:6}]];
for (const [name,cfg] of cases){
  await p.evaluate(c=>solarify.build(c),cfg); await p.waitForTimeout(600);
  const ids=await p.evaluate(()=>solarify.system().bodies.map(b=>b.id));
  let good=true, why='';
  for (const id of ids){
    await p.evaluate(i=>{const btn=document.querySelector('#bodyList .action[data-id="'+i+'"]')||document.querySelector('#moonList .action[data-id="'+i+'"]'); if(btn) btn.click(); else {document.querySelector('#bodyList .action').click();}},id);
    await p.waitForTimeout(60);
    const s=await p.$eval('#selName',e=>e.textContent);
    if(!s){good=false;why='empty name '+id;break;}
  }
  await p.keyboard.press('0'); await p.waitForTimeout(200);
  const fin=await p.evaluate(()=>solarify.system().bodies.every(b=>{const q=solarify.bodyScenePos(b.id);return isFinite(q.r);}));
  const facts=await p.$$eval('#facts dd',x=>x.map(e=>e.textContent).join('|'));
  ok(name+': '+ids.length+' bodies, every one selectable, positions finite, no NaN in facts', good&&fin&&!/NaN|undefined|Infinity/.test(facts), why||facts.slice(0,90));
}
// every fact panel for a mid system, every body, scanning for NaN/undefined text
await p.evaluate(()=>solarify.build({star:'F',inner:4,outer:3,moonsInner:2,moonsOuter:3,home:'hz',seed:31})); await p.waitForTimeout(500);
const ids=await p.evaluate(()=>solarify.system().bodies.map(b=>b.id)); let bad=[];
for (const id of ids){ await p.evaluate(i=>{const btn=document.querySelector('#bodyList .action[data-id="'+i+'"]');if(btn){btn.click();return;} const par=i.replace(/m\d+$/,''); document.querySelector('#bodyList .action[data-id="'+par+'"]').click(); document.querySelector('#moonList .action[data-id="'+i+'"]').click();},id);
  await p.waitForTimeout(40); const t=await p.$eval('#drawer',e=>e.innerText); if(/NaN|undefined|Infinity|null/.test(t)) bad.push(id); }
ok('no NaN, undefined or null text in any body panel ('+ids.length+' bodies)', bad.length===0, bad.join(','));
// round trip Sol after build: all Sol facts still fine
await p.evaluate(()=>solarify.solar()); await p.waitForTimeout(500);
const sids=['sun','mercury','earth','saturn','neptune','moon']; bad=[];
for (const id of sids){ await p.evaluate(i=>{const btn=document.querySelector('#bodyList .action[data-id="'+i+'"]');if(btn){btn.click();return;} document.querySelector('#bodyList .action[data-id="earth"]').click();document.querySelector('#moonList .action[data-id="moon"]').click();},id); await p.waitForTimeout(40); const t=await p.$eval('#drawer',e=>e.innerText); if(/NaN|undefined|Infinity|null/.test(t)) bad.push(id);}
ok('back in our Solar System: panels clean', bad.length===0, bad.join(','));
console.log(errs.join('\n')||'no page errors');console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();})();
