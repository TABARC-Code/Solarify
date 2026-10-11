// Solarify browser check: overrides. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto(BASE+'/index.html');await p.waitForTimeout(3000);
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'hz',age:46,giants:'c',companion:'n',seed:4242}));
await p.waitForTimeout(1500);
ok('size row hidden in whole-system view of a star', await p.$eval('#sizeRow',e=>e.hidden));
await p.click('#bodyList .action[data-id="p2"]'); await p.waitForTimeout(500);
ok('size row shows for a planet', !(await p.$eval('#sizeRow',e=>e.hidden)));
const opts=await p.$$eval('#sizeSel option',o=>o.map(x=>x.textContent));
ok('rocky options: Auto + 4 classes', opts.length===5 && /^Auto \(/.test(opts[0]), opts.join(','));
const diam=()=>p.$eval('#facts',e=>e.innerText);
const before=await diam();
const radiiBefore=await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p2'&&!/^p2m/.test(b.id)).map(b=>b.id+':'+b.radiusKm).join('|'));
await p.selectOption('#sizeSel',{label:'Tiny'}); await p.waitForTimeout(1500);
const after=await diam();
ok('still focused on the same planet after resize', (await p.$eval('#selName',e=>e.textContent))===(await p.evaluate(()=>solarify.system().bodies.find(b=>b.id==='p2').name)));
ok('panel now says Tiny', /Tiny/.test(after) && before!==after);
ok('select shows Tiny', (await p.$eval('#sizeSel',e=>e.selectedOptions[0].textContent))==='Tiny');
const radiiAfter=await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p2'&&!/^p2m/.test(b.id)).map(b=>b.id+':'+b.radiusKm).join('|'));
ok('other bodies unchanged in the browser too', radiiBefore===radiiAfter);
ok('address bar carries the size', /#s=4\..*\.2x0$/.test(await p.evaluate(()=>location.hash)) || /x0/.test(await p.evaluate(()=>location.hash)), await p.evaluate(()=>location.hash));
// giant
await p.click('#bodyList .action[data-id="p6"]'); await p.waitForTimeout(400);
const gopts=await p.$$eval('#sizeSel option',o=>o.map(x=>x.textContent));
ok('giant options: Auto + Small/Medium/Large giant', gopts.length===4 && /giant/.test(gopts[3]), gopts.join(','));
await p.selectOption('#sizeSel',{label:'Large giant'}); await p.waitForTimeout(1500);
ok('giant now Large', /Large giant/.test(await diam()));
// back to auto
await p.click('#bodyList .action[data-id="p2"]'); await p.waitForTimeout(300);
await p.selectOption('#sizeSel','auto'); await p.waitForTimeout(1500);
const hash=await p.evaluate(()=>location.hash); ok('only the giant override left in link', /\.6x6$/.test(hash), hash);
// survives slider change
await p.evaluate(()=>{const e=document.getElementById('fMoonsInner');e.value=0;e.dispatchEvent(new Event('change',{bubbles:true}));});
await p.waitForTimeout(1500);
ok('override survives a slider change', /\.6x6$/.test(await p.evaluate(()=>location.hash)));
// roll clears
await p.click('#fRoll'); await p.waitForTimeout(1500);
ok('Roll a new system clears size overrides', /\.-$/.test(await p.evaluate(()=>location.hash)), await p.evaluate(()=>location.hash));
// size row hidden in solar mode
await p.click('#modeSol'); await p.waitForTimeout(1500); await p.click('#bodyList .action[data-id="earth"]');
ok('no size picker for our own planets', await p.$eval('#sizeRow',e=>e.hidden));

// ---- exact diameter
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'hz',age:46,giants:'c',companion:'n',seed:4242}));
await p.waitForTimeout(1500);
await p.click('#bodyList .action[data-id="p3"]'); await p.waitForTimeout(400);
const setSlider=async v=>{ await p.evaluate(v=>{const e=document.getElementById('sizeDiam');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},v); await p.waitForTimeout(1500); };
const info=()=>p.evaluate(()=>{const b=solarify.system().bodies.find(x=>x.id==='p3');return {r:b.radiusKm/6378,min:b.diamMin,max:b.diamMax,set:b.diamSet,cls:b.sizeClass,type:b.worldType};});
const i0=await info();
const othersBefore=await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p3'&&!/^p3m/.test(b.id)).map(b=>b.id+':'+b.radiusKm).join('|'));
ok('diameter row visible and reset disabled before any change', !(await p.$eval('#sizeRow',e=>e.hidden)) && await p.$eval('#diamReset',e=>e.disabled));
await setSlider(1000); const i1=await info();
ok('slider at the top gives the class maximum', Math.abs(i1.r-i1.max)<1e-6 && i1.set && i1.cls===i0.cls && i1.type===i0.type, i0.r.toFixed(3)+' to '+i1.r.toFixed(3));
ok('focus stays on the planet and the panel shows the new diameter', (await p.$eval('#selName',e=>e.textContent)).length>0 && /km/.test(await p.$eval('#facts',e=>e.innerText)));
ok('output label matches', (await p.$eval('#oDiam',e=>e.textContent)).startsWith(i1.max.toFixed(2).slice(0,3)), await p.$eval('#oDiam',e=>e.textContent));
ok('reset button now enabled', !(await p.$eval('#diamReset',e=>e.disabled)));
await setSlider(0); const i2=await info(); ok('slider at the bottom gives the class minimum', Math.abs(i2.r-i2.min)<1e-6, i2.r.toFixed(3));
ok('other bodies unchanged', othersBefore===await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p3'&&!/^p3m/.test(b.id)).map(b=>b.id+':'+b.radiusKm).join('|')));
ok('link carries the diameter', /\.-\.3x0$/.test(await p.evaluate(()=>location.hash)), await p.evaluate(()=>location.hash));
await p.click('#diamReset'); await p.waitForTimeout(1500); const i3=await info();
ok('Rolled diameter restores the original', Math.abs(i3.r-i0.r)<1e-9 && !i3.set && /\.-$/.test(await p.evaluate(()=>location.hash)));
await setSlider(300); await p.selectOption('#sizeSel',{label:'Tiny'}); await p.waitForTimeout(1500);
const i4=await info(); ok('changing class drops the diameter and starts from the new class roll', i4.cls==='Tiny' && !i4.set);
await p.click('#bodyList .action[data-id="p6"]'); await p.waitForTimeout(400); await setSlider(1000);
const gi=await p.evaluate(()=>{const b=solarify.system().bodies.find(x=>x.id==='p6');return Math.abs(b.radiusKm/6378-b.diamMax)<1e-6;});
ok('a giant takes an exact diameter', gi);
// project round trip keeps the diameter
const link=await p.evaluate(()=>location.hash); const rad=await p.evaluate(()=>solarify.system().bodies.find(x=>x.id==='p6').radiusKm);
await p.evaluate(()=>solarify.solar()); await p.waitForTimeout(800); await p.evaluate(h=>{location.hash=h;},link); await p.waitForTimeout(1800);
ok('opening the link restores the exact diameter', Math.abs(rad-(await p.evaluate(()=>solarify.system().bodies.find(x=>x.id==='p6').radiusKm)))<1e-6);

// ---- world type
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'none',giants:'c',companion:'n',age:46,seed:4242}));
await p.waitForTimeout(1800); await p.click('#bodyList .action[data-id="p2"]'); await p.waitForTimeout(500);
const tinfo=()=>p.evaluate(()=>{const b=solarify.system().bodies.find(x=>x.id==='p2');return {t:b.worldType,set:b.typeSet,auto:b.typeAuto,cls:b.sizeClass,r:b.radiusKm};});
const t0=await tinfo(); const topts=await p.$$eval('#typeSel option',o=>o.map(x=>({v:x.value,t:x.textContent})));
ok('world type select lists Auto plus the class options', topts.length>=4 && /^Auto: /.test(topts[0].t), topts.map(x=>x.t).join(' | '));
const pick=topts.slice(1).find(o=>!t0.t||!o.t.startsWith(t0.t));
const othersT=await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p2'&&!/^p2m/.test(b.id)).map(b=>b.id+':'+b.radiusKm+b.worldType).join('|'));
await p.selectOption('#typeSel',pick.v); await p.waitForTimeout(1600);
const t1=await tinfo(); ok('type changed and flagged', t1.set && t1.t!==t0.t && t1.cls===t0.cls, t0.t+' to '+t1.t);
ok('other planets unchanged by a type change', othersT===await p.evaluate(()=>solarify.system().bodies.filter(b=>b.id!=='p2'&&!/^p2m/.test(b.id)).map(b=>b.id+':'+b.radiusKm+b.worldType).join('|')));
ok('panel shows the new type', (await p.$eval('#facts',e=>e.innerText)).includes(t1.t));
ok('link ends with the type field', /\.-\.-\.2x\d$/.test(await p.evaluate(()=>location.hash)), await p.evaluate(()=>location.hash));
await p.selectOption('#typeSel','auto'); await p.waitForTimeout(1600);
ok('Auto restores the rolled type and drops the field', (await tinfo()).t===t0.t && !(await tinfo()).set && /\.-$/.test(await p.evaluate(()=>location.hash)));
await p.selectOption('#typeSel',pick.v); await p.waitForTimeout(1500);
await p.selectOption('#sizeSel',{label:'Tiny'}); await p.waitForTimeout(1600);
ok('changing the size class clears the type override', !(await tinfo()).set, JSON.stringify(await tinfo()));
await p.click('#bodyList .action[data-id="p6"]'); await p.waitForTimeout(400);
ok('no world type picker for giants', await p.$eval('#typeWrap',e=>e.hidden));
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'none',giants:'c',companion:'n',age:46,seed:4242}));
await p.waitForTimeout(1500); await p.click('#bodyList .action[data-id="p2"]'); await p.waitForTimeout(400);
await p.selectOption('#typeSel',pick.v); await p.waitForTimeout(1500); const lk=await p.evaluate(()=>location.hash); const rr=(await tinfo()).t;
await p.evaluate(()=>solarify.solar()); await p.waitForTimeout(800); await p.evaluate(h=>{location.hash=h;},lk); await p.waitForTimeout(1800);
ok('opening the link restores the type', (await tinfo()).t===rr && (await tinfo()).set);
console.log(errs.join('\n')||'no page errors'); console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0; await b.close();})();
