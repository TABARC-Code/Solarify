// Solarify browser check: basics. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true});
const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
const url=BASE+'/index.html';
await p.goto(url);await p.waitForTimeout(5000);
const sel=()=>p.$eval('#selName',e=>e.textContent);
const S=(f)=>p.evaluate(f);
let fails=0;const ok=(name,cond,extra='')=>{console.log((cond?'PASS':'FAIL')+' | '+name+(extra?'  ['+extra+']':''));if(!cond)fails++;};

// --- focus keys
for (const [k,n] of [['1','Mercury'],['3','Earth'],['5','Jupiter'],['8','Neptune'],['9','Moon']]){ await p.keyboard.press(k); ok('key '+k+' selects '+n,(await sel())===n); }
await p.keyboard.press('0'); ok('key 0 -> whole system (Sun)', (await sel())==='Sun' && await p.$eval('#overview',e=>e.getAttribute('aria-pressed'))==='true');

// --- pause / speed / reverse
await p.keyboard.press(' '); ok('Space pauses', await S(()=>solarify.state.paused)===true && (await p.$eval('#playPause',e=>e.textContent))==='Play');
const j0=await S(()=>solarify.state.jd); await p.waitForTimeout(600); ok('paused: date does not move', (await S(()=>solarify.state.jd))===j0);
await p.keyboard.press(' ');
const j1=await S(()=>solarify.state.jd); await p.waitForTimeout(800); const j2=await S(()=>solarify.state.jd); ok('running: date moves forward', j2>j1, (j2-j1).toFixed(2)+' days in ~0.8s at 10 d/s');
await p.keyboard.press('r'); const j3=await S(()=>solarify.state.jd); await p.waitForTimeout(800); const j4=await S(()=>solarify.state.jd); ok('R reverses: date moves back', j4<j3);
await p.keyboard.press('r');
const sp0=await S(()=>solarify.state.speedIdx); await p.keyboard.press(']'); ok('] speeds up', await S(()=>solarify.state.speedIdx)===sp0+1, await p.$eval('#speedLabel',e=>e.textContent));
await p.keyboard.press('['); await p.keyboard.press('['); ok('[ [ slows down twice', await S(()=>solarify.state.speedIdx)===sp0-1);
await p.keyboard.press(']');
await p.keyboard.press(' '); await p.click('#today'); { const now=Date.now(), shown=Date.parse(await S(()=>solarify.date())); ok('Back to today resets to now (paused first, so exact)', Math.abs(now-shown)<5000, ((shown-now)/1000).toFixed(1)+' s off'); } await p.keyboard.press(' ');
await p.keyboard.press(' '); // pause for stability

// --- toggles
await p.keyboard.press('l'); ok('L hides labels', await p.$eval('#tLabels',e=>e.getAttribute('aria-pressed'))==='false' && await p.$eval('#labels',e=>e.style.display)==='none');
await p.keyboard.press('l');
await p.keyboard.press('o'); ok('O hides orbits', await S(()=>solarify.state.orbits)===false); await p.keyboard.press('o');

// --- zoom + look
await p.keyboard.press('3'); await p.waitForTimeout(1800);
const camDist=()=>p.evaluate(()=>{const c=document.querySelector('#stage canvas');return null;});
const zoomTest=async(key)=>{const before=await S(()=>solarify.screenOf('earth').pxRadius);for(let i=0;i<4;i++)await p.keyboard.press(key);await p.waitForTimeout(1500);return [before,await S(()=>solarify.screenOf('earth').pxRadius)];};
let [zb,za]=await zoomTest('+'); ok('+ zooms in (Earth gets bigger on screen)', za>zb*1.3, zb.toFixed(0)+' -> '+za.toFixed(0)+' px');
[zb,za]=await zoomTest('-'); ok('- zooms out', za<zb*0.8, zb.toFixed(0)+' -> '+za.toFixed(0)+' px');
await p.keyboard.press('0'); await p.waitForTimeout(2500);

// --- pick by clicking a planet on the canvas
const jp=await S(()=>solarify.screenOf('jupiter'));
await p.mouse.click(jp.x, jp.y); await p.waitForTimeout(300); ok('clicking Jupiter on the canvas selects it', (await sel())==='Jupiter', 'clicked '+Math.round(jp.x)+','+Math.round(jp.y));
await p.keyboard.press('0'); await p.waitForTimeout(2000);
await p.mouse.dblclick(80,600); await p.waitForTimeout(500); ok('double-click on empty space -> whole system', (await sel())==='Sun');
// click a label
await p.keyboard.press('0'); await p.waitForTimeout(1500);
await p.click('.tag:has-text("Saturn")'); ok('clicking a label selects it', (await sel())==='Saturn');
// list button + aria-pressed
await p.click('#bodyList .action[data-id="mars"]'); ok('body list button selects Mars and marks it pressed', (await sel())==='Mars' && await p.$eval('#bodyList .action[data-id="mars"]',e=>e.getAttribute('aria-pressed'))==='true' && await p.$eval('#bodyList .action[data-id="earth"]',e=>e.getAttribute('aria-pressed'))==='false');

// --- facts / live values
await p.keyboard.press('3'); await p.waitForTimeout(700);
const facts=await p.$eval('#facts',e=>e.innerText.replace(/\n/g,' | '));
ok('Earth facts show NASA table values', /12,756 km/.test(facts) && /23\.9 hours/.test(facts) && /23\.4°/.test(facts) && /365\.2 days/.test(facts) && /AU/.test(facts) && /Sunlight takes/.test(facts), facts.slice(0,150));
await p.keyboard.press('9'); await p.waitForTimeout(700);
const mf=await p.$eval('#facts',e=>e.innerText.replace(/\n/g,' | '));
ok('Moon facts: 3,475 km, 27.3 days, locked, phase line', /3,475 km/.test(mf) && /27\.3 days/.test(mf) && /locked to Earth/.test(mf) && /Phase now/.test(mf), mf.slice(0,200));

// --- scale modes
await p.evaluate(()=>document.getElementById('sec-view').open=true);
const nSq=await S(()=>solarify.bodyScenePos('neptune').r);
await p.click('#distTrue'); const nTr=await S(()=>solarify.bodyScenePos('neptune').r);
ok('True distances: Neptune sits ~13x further out', nTr/nSq>10 && nTr/nSq<16, nSq.toFixed(1)+' -> '+nTr.toFixed(1)+' scene units');
await p.click('#distSqueezed');
const eR=await S(()=>{const g=solarify; return g.screenOf('earth').pxRadius;});
await p.click('#sizeTrue'); ok('sizes toggle: aria-pressed flips', await p.$eval('#sizeTrue',e=>e.getAttribute('aria-pressed'))==='true' && await p.$eval('#sizeBig',e=>e.getAttribute('aria-pressed'))==='false');
await p.click('#sizeBig');

// --- own map
const png=await p.evaluate(async()=>{const k=document.createElement('canvas');k.width=400;k.height=200;const x=k.getContext('2d');x.fillStyle='#ff00ff';x.fillRect(0,0,400,200);const bl=await new Promise(r=>k.toBlob(r));return Array.from(new Uint8Array(await bl.arrayBuffer()));});
await p.keyboard.press('4'); await p.waitForTimeout(2200);
const centre=()=>p.evaluate(()=>{const c=document.querySelector('#stage canvas');const k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);
  const r=window.solarify.screenOf('mars');const sx=c.width/c.clientWidth;const d=x.getImageData(Math.round(r.x*sx-r.pxRadius*0.15*sx),Math.round(r.y*sx),1,1).data;return [d[0],d[1],d[2]];});
const before=await centre();
await p.evaluate((a)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(a)],'magenta.png',{type:'image/png'}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},png);
await p.waitForTimeout(1200);
const after=await centre();
ok('dropping a map dresses Mars (pixel turns magenta)', after[0]>after[1]+40 && after[2]>after[1]+40 && !(before[0]>before[1]+40 && before[2]>before[1]+40), 'before rgb('+before+') after rgb('+after+')');
ok('message names Mars and says nothing is uploaded', /Mars now wears magenta\.png/.test(await p.$eval('#mapMsg',e=>e.textContent)) && /nothing is uploaded/.test(await p.$eval('#mapMsg',e=>e.textContent)));
ok('Built-in look enabled', (await p.$eval('#mapReset',e=>e.disabled))===false);
await p.click('#mapReset'); await p.waitForTimeout(800);
const reset=await centre(); ok('Built-in look restores the texture', !(reset[0]>reset[1]+40 && reset[2]>reset[1]+40), 'rgb('+reset+')');
await p.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File(['hello'],'notes.txt',{type:'text/plain'}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
await p.waitForTimeout(300); ok('dropping a non-image is refused politely', /does not look like an image/.test(await p.$eval('#mapMsg',e=>e.textContent)));
// via the button
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#mapBtn')]);
await fc.setFiles({name:'again.png',mimeType:'image/png',buffer:Buffer.from(png)}); await p.waitForTimeout(800);
ok('Use my own map… opens a file chooser and applies the file', /now wears again\.png/.test(await p.$eval('#mapMsg',e=>e.textContent)));
await p.click('#mapReset');

// --- help overlay
await p.keyboard.press('?'); ok('? opens help, focus on Close', await p.$eval('#help',e=>!e.hidden) && await p.evaluate(()=>document.activeElement.id)==='helpClose');
for(let i=0;i<4;i++) await p.keyboard.press('Tab'); ok('Tab stays trapped in help', await p.evaluate(()=>document.activeElement.id)==='helpClose');
await p.keyboard.press('Escape'); ok('Esc closes help', await p.$eval('#help',e=>e.hidden));
await p.keyboard.press('3'); 

// --- PNG save
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#savePng')]);
const path=await dl.path(); const buf=fs.readFileSync(path); const w=buf.readUInt32BE(16), h=buf.readUInt32BE(20);
const pw=await p.$eval('#drawer',e=>e.getBoundingClientRect().left);
ok('Save as PNG downloads a PNG named for body and date', /^solarify-earth-\d{4}-\d{2}-\d{2}\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
ok('PNG is the visible area only (panel cropped off)', Math.abs(w-Math.round(pw))<=2 && h===768, w+'x'+h+' vs visible '+Math.round(pw)+'x768');

// --- persistence
await p.keyboard.press('l'); await p.keyboard.press('o');
await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(3000);
ok('view toggles persist across reload', await p.$eval('#tLabels',e=>e.getAttribute('aria-pressed'))==='false' && await p.$eval('#tOrbits',e=>e.getAttribute('aria-pressed'))==='false');
await p.keyboard.press('l'); await p.keyboard.press('o');
console.log(errs.join('\n')||'no page errors'); console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;
await b.close();})();
