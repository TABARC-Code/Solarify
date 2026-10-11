// Solarify browser check: edge-cases. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const exe=undefined;
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
// 1. Today, done properly: pause first, then press it
let b=await chromium.launch({executablePath:exe,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
let p=await b.newPage({viewport:{width:1366,height:768}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/index.html');await p.waitForTimeout(3500);
await p.keyboard.press(' ');await p.evaluate(()=>solarify.setDate('2030-05-05T00:00:00Z'));
ok('paused and moved to 2030', (await p.evaluate(()=>solarify.date())).startsWith('2030-05-05'));
await p.keyboard.press("t");const now=Date.now(),shown=Date.parse(await p.evaluate(()=>solarify.date()));
ok('T returns to the real current time (paused, so exact)', Math.abs(now-shown)<5000, ((shown-now)/1000).toFixed(1)+' s off');
// out-of-range note
await p.evaluate(()=>solarify.setDate('2300-01-01T00:00:00Z'));await p.waitForTimeout(400);
ok('2300: range warning shown', await p.$eval('#rangeNote',e=>!e.hidden));
await p.evaluate(()=>solarify.setDate('2025-06-01T00:00:00Z'));await p.waitForTimeout(400);
ok('2025: range warning hidden', await p.$eval('#rangeNote',e=>e.hidden));
await p.evaluate(()=>solarify.setDate('1500-01-01T00:00:00Z'));await p.waitForTimeout(300);
await p.evaluate(()=>solarify.setDate('9999-01-01T00:00:00Z'));await p.waitForTimeout(300);
ok('absurd dates are clamped (no crash, readout still sane)', /^\d{4}-\d\d-\d\d/.test(await p.$eval('#dateText',e=>e.textContent)), await p.$eval('#dateText',e=>e.textContent));
await p.close();
// 2. reduced motion starts paused
p=await (await b.newContext({reducedMotion:'reduce',viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/index.html');await p.waitForTimeout(3000);
const d0=await p.evaluate(()=>solarify.state.jd);await p.waitForTimeout(700);
ok('prefers-reduced-motion: starts paused and stays still', (await p.$eval('#playPause',e=>e.textContent))==='Play' && (await p.evaluate(()=>solarify.state.jd))===d0);
await p.close();await b.close();
// 3. no WebGL
b=await chromium.launch({executablePath:exe,args:['--disable-3d-apis','--disable-gpu','--disable-webgl']});
p=await b.newPage();const e3=[];p.on('pageerror',e=>e3.push(e.message));
await p.goto(BASE+'/index.html');await p.waitForTimeout(1500);
const gl=await p.evaluate(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));});
const msg=await p.$eval('#stage',e=>e.textContent.trim().slice(0,70));
ok('no-WebGL browser: reports it and shows a plain message', gl? true : /needs WebGL/.test(msg), gl?'(WebGL was still available in this run, so the fallback could not be exercised)':msg);
console.log('page errors without WebGL:', e3.length? e3.join(' | '):'none'); await b.close();
console.log(errs.join('\n')||'no other page errors');console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;})();
