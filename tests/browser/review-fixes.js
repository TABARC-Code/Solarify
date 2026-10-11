// Solarify browser check: review-fixes. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};const errs=[];
// 1. hostile hash
let p=await (await b.newContext({viewport:{width:1366,height:800}})).newPage();
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
await p.goto(BASE+'/index.html#s=4.constructor.0.46.4.4.1.1.3.hz.c.n.1.-');await p.waitForTimeout(3000);
ok('a link naming "constructor" as the star leaves a working page', await p.evaluate(()=>!!window.solarify && solarify.mode()==='sol'));
// 2. overrides cleared on structural change, kept on moon slider
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'hz',age:46,giants:'c',companion:'n',seed:4242}));await p.waitForTimeout(1500);
await p.click('#bodyList .action[data-id="p3"]');await p.waitForTimeout(300);
await p.evaluate(()=>{const e=document.getElementById('sizeDiam');e.value=900;e.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(1500);
ok('diameter override set', /\.3x900$/.test(await p.evaluate(()=>location.hash)));
await p.evaluate(()=>{const e=document.getElementById('fMoonsInner');e.value=1;e.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(1500);
ok('kept across a moon-count change', /\.3x900$/.test(await p.evaluate(()=>location.hash)));
await p.evaluate(()=>{const e=document.getElementById('fInner');e.value=2;e.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(1500);
ok('cleared when the rocky planet count changes, with a toast', /\.-$/.test(await p.evaluate(()=>location.hash)) && /cleared/.test(await p.$eval('#toast',e=>e.textContent)), await p.evaluate(()=>location.hash));
await p.close();
// 3/4. phone drawer
p=await (await b.newContext({viewport:{width:390,height:800}})).newPage();
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
await p.goto(BASE+'/index.html');await p.waitForTimeout(3000);
const ro=await p.$eval('#readout',e=>e.getBoundingClientRect().bottom);
ok('closed drawer: readout sits just above the handle, not mid-screen', ro > 800-46-40 && ro <= 800-46, 'readout bottom '+Math.round(ro));
await p.focus('#handle'); const paused0=await p.evaluate(()=>solarify.state.paused);
await p.keyboard.press('Enter'); await p.waitForTimeout(500);
ok('Enter on the handle opens the drawer', !(await p.$eval('#drawer',e=>e.classList.contains('closed'))));
await p.keyboard.press(' '); await p.waitForTimeout(500);
ok('Space on the handle closes it and does not pause time', await p.$eval('#drawer',e=>e.classList.contains('closed')) && (await p.evaluate(()=>solarify.state.paused))===paused0);
console.log(errs.join('\n')||'no page errors'); console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0; await b.close();})();
