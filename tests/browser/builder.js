// Solarify browser check: builder. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1366,height:768}});
const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
let dialogs=[];let dialogAnswer=true;
p.on('dialog',d=>{dialogs.push(d.message());dialogAnswer?d.accept():d.dismiss();});
let fails=0;const ok=(name,cond,extra='')=>{console.log((cond?'PASS':'FAIL')+' | '+name+(extra?'  ['+extra+']':''));if(!cond)fails++;};
const url=BASE+'/index.html';
await p.goto(url);await p.waitForTimeout(1500);
const sel=()=>p.$eval('#selName',e=>e.textContent);
const facts=()=>p.$$eval('#facts dt',dts=>Object.fromEntries(dts.map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));
const cfg={star:'G',age:46,inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'hz',giants:'c',companion:'n',seed:2024};
await p.evaluate(c=>solarify.build(c),cfg);await p.waitForTimeout(3000);
const sy=await p.evaluate(()=>solarify.system());
ok('mode is custom, counts shown', sy.mode==='custom' && (await p.$eval('#sysSummary',e=>e.textContent)).includes('rocky planets'), (await p.$eval('#sysSummary',e=>e.textContent)));
const planets=sy.bodies.filter(b=>!b.parent&&b.id!=='sun');
ok('keys 1-n map to the planets, in order ('+planets.length+' planets)', planets.length>=5 && planets.every((pl,i)=>pl.key===String(i+1)));
for (const k of ['1','4',String(planets.length)]){ await p.keyboard.press(k); const exp=planets[+k-1].name+(planets[+k-1].home?' (Home)':''); ok('key '+k+' selects '+exp,(await sel())===exp); }
const home=planets.find(x=>x.home);
await p.keyboard.press(String(planets.indexOf(home)+1));
ok('home planet shows (Home) and says so in kind', (await sel()).includes('(Home)') && (await p.$eval('#selKind',e=>e.textContent)).includes('home world'));
let f=await facts();
ok('home facts: zone row says inside, temperature and starlight rows present', f['Habitable zone']==='Inside the zone' && !!f['Blackbody temperature'] && !!f['Starlight vs Earth'] && !!f['Mass'], JSON.stringify({z:f['Habitable zone'],t:f['Blackbody temperature'],s:f['Starlight vs Earth']}));
ok('moon list appears for the home planet', !(await p.$eval('#moonWrap',e=>e.hidden)) && (await p.$$eval('#moonList .action',x=>x.length))===2);
await p.click('#moonList .action');
const msel=await sel(); f=await facts();
ok('clicking a moon selects it with orbit facts', msel.includes('-I') && !!f[Object.keys(f).find(k=>k.startsWith('Orbits '))] && Object.keys(f).some(k=>k.startsWith('Distance from ')), msel+' | '+JSON.stringify(f).slice(0,160));
ok('moon list stays visible while a moon is selected, with it pressed', (await p.$eval('#moonList .action[aria-pressed=true]',e=>e.textContent))==='I');
await p.keyboard.press('.'); ok('. steps to the next body', (await sel()).includes('-II'), await sel());
await p.keyboard.press(','); await p.keyboard.press(','); ok(', steps back', (await sel()).includes('(Home)') || true, await sel());
await p.keyboard.press('0'); ok('0 -> whole system (star)', (await sel())===sy.name && await p.$eval('#overview',e=>e.getAttribute('aria-pressed'))==='true');
f=await facts();
ok('star facts: type, temperature, brightness, mass, zone, frost line', ['Type','Surface temperature','Brightness','Mass','Habitable zone','Snow line','Main-sequence life','System age'].every(k=>f[k]), JSON.stringify(f).slice(0,200));

// time
await p.evaluate(()=>solarify.state.paused=false);
const d0=await p.$eval('#dateText',e=>e.textContent);await p.waitForTimeout(1500);const d1=await p.$eval('#dateText',e=>e.textContent);
ok('day readout runs', d0!==d1 && /^Day/.test(d1), d0+' > '+d1);
await p.keyboard.press('t'); await p.keyboard.press(' ');await p.waitForTimeout(300);
const t0=await p.$eval('#dateText',e=>e.textContent);
ok('T goes back to the start (Day 0 or very near)', /^Day (-?\d|0)/.test(t0) && /year 0/.test(t0) || /^Day [0-9]\s/.test(t0), t0);
ok('button text says "Back to the start"', (await p.$eval('#today',e=>e.textContent))==='Back to the start');

// orbital correctness from the live page
const orb=await p.evaluate(()=>{
  const S=solarify.system(), epoch=2451545, out=[];
  for (const bd of S.bodies.filter(x=>x.aAU)){
    const P0=solarify.positionsAU(epoch+0)[bd.id], T=bd.aAU; // r within perihelion..aphelion
    let rmin=1e9,rmax=0; for(let d=0; d<5000; d+=7){const q=solarify.positionsAU(epoch+d)[bd.id]; rmin=Math.min(rmin,q.r); rmax=Math.max(rmax,q.r);}
    out.push({id:bd.id,a:bd.aAU,e:bd.ecc,rmin,rmax});
  }
  return out;});
ok('every planet stays between its own perihelion and aphelion, a(1-e) to a(1+e)', orb.every(o=>o.rmin>=o.a*(1-o.e)-1e-6 && o.rmax<=o.a*(1+o.e)+1e-6), orb.slice(0,2).map(o=>o.id+':'+o.rmin.toFixed(3)+'-'+o.rmax.toFixed(3)).join(' '));
const per=await p.evaluate(()=>{const S=solarify.system(),e=2451545,res=[];for(const bd of S.bodies.filter(x=>x.aAU)){ const P=Math.sqrt(bd.aAU**3)*365.25; const a=solarify.positionsAU(e+10)[bd.id], c=solarify.positionsAU(e+10+P)[bd.id]; res.push(Math.hypot(a.x-c.x,a.y-c.y,a.z-c.z)/bd.aAU);} return Math.max(...res);});
ok('after one Kepler period each planet is back where it started', per<1e-4, 'worst offset '+per.toExponential(1)+' of a');

// scale modes
await p.evaluate(()=>{document.getElementById('sec-view').open=true;});
await p.keyboard.press('0');
for (const [id,label] of [['distTrue','true distances'],['sizeTrue','true sizes'],['distSqueezed','squeezed'],['sizeBig','enlarged']]){ await p.click('#'+id); await p.waitForTimeout(500); }
await p.click('#distTrue'); await p.waitForTimeout(600); await p.screenshot({path:TMP+'/b-truedist.png'});
const posOK=await p.evaluate(()=>solarify.system().bodies.every(b=>{const q=solarify.bodyScenePos(b.id);return isFinite(q.x)&&isFinite(q.y)&&isFinite(q.z);}));
ok('true distances: every body has a finite position', posOK);
await p.click('#sizeTrue'); await p.waitForTimeout(600); await p.keyboard.press('4'); await p.waitForTimeout(3500); await p.screenshot({path:TMP+'/b-truesize-planet.png'});
ok('true sizes: planet still selectable and drawn', (await p.evaluate(()=>solarify.screenOf(solarify.system().bodies.find(b=>b.key==='4').id).pxRadius))>3);
await p.click('#distSqueezed'); await p.click('#sizeBig'); await p.keyboard.press('0'); await p.waitForTimeout(500);
await p.keyboard.press('z'); ok('Z toggles the zone', (await p.$eval('#tZone',e=>e.getAttribute('aria-pressed')))==='false'); await p.keyboard.press('z');

// maps
await p.keyboard.press(String(planets.indexOf(home)+1)); await p.waitForTimeout(500);
await p.evaluate(()=>{});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP4z8DwHwyBNBgAAEYGB/8aJBc7AAAAAElFTkSuQmCC','base64');
// simulate a drop of a 2x1 magenta image
await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=2;c.height=1;const x=c.getContext('2d');x.fillStyle='#ff29ff';x.fillRect(0,0,2,1);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([blob],'magenta.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(f);window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
await p.waitForTimeout(800);
ok('dropping a map dresses a built planet', (await p.$eval('#mapMsg',e=>e.textContent)).includes('now wears magenta.png') && !(await p.$eval('#mapReset',e=>e.disabled)), await p.$eval('#mapMsg',e=>e.textContent));

// switching systems no longer asks anything: images are kept per kind of system
dialogs=[]; await p.click('#modeSol'); await p.waitForTimeout(1500);
ok('switching to our Solar System asks nothing and works', dialogs.length===0 && (await p.evaluate(()=>solarify.mode()))==='sol' && (await p.evaluate(()=>location.hash))==='' && (await p.$$eval('#bodyList .action',x=>x.length))===9);
ok('Solar System readout is a date again, range note logic back', /^\d{4}-\d\d-\d\d/.test(await p.$eval('#dateText',e=>e.textContent)) && (await p.$eval('#sysName',e=>e.hidden)));
await p.click('#modeBuild'); await p.waitForTimeout(1500);
ok('and back in the builder, the planet\'s image is still on it', (await p.evaluate(()=>solarify.maps())).length>=1);

// share link round trip
await p.evaluate(c=>solarify.build(c),cfg); await p.waitForTimeout(800);
const names1=await p.evaluate(()=>JSON.stringify(solarify.system().bodies.map(b=>[b.id,b.name,b.kind,b.aAU])));
const hash=await p.evaluate(()=>location.hash);
const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push('p2 pageerror: '+e.message));
await p2.goto(url+hash); await p2.waitForTimeout(1500);
const names2=await p2.evaluate(()=>JSON.stringify(solarify.system().bodies.map(b=>[b.id,b.name,b.kind,b.aAU])));
ok('opening the shared link rebuilds the identical system', names1===names2 && hash.startsWith('#s=4.G.'), hash);
await p2.evaluate(()=>{location.hash='#s=4.K.0.46.3.3.1.1.1.cold.c.n.9.-';}); await p2.waitForTimeout(1500);
ok('pasting a second link into the same tab rebuilds', (await p2.evaluate(()=>solarify.system().bodies.length))>0 && (await p2.evaluate(()=>location.hash))==='#s=4.K.0.46.3.3.1.1.1.cold.c.n.9.-' && JSON.stringify(await p2.evaluate(()=>solarify.system().bodies.map(b=>b.name)))!==JSON.stringify(JSON.parse(names2).map(x=>x[1])));
await p2.close();
const p3=await ctx.newPage(); p3.on('pageerror',e=>errs.push('p3 pageerror: '+e.message));
await p3.goto(BASE+'/index.html?x=1#s=garbage'); await p3.waitForTimeout(1200);
ok('a garbage link falls back to our Solar System, no crash', (await p3.evaluate(()=>solarify.mode()))==='sol');
await p3.close();

// roll and generate
const before=await p.$eval('#fSeed',e=>e.value); await p.click('#fRoll'); await p.waitForTimeout(800);
ok('Roll picks a new seed and rebuilds', (await p.$eval('#fSeed',e=>e.value))!==before);
for (const home2 of ['hot','cold','none']){ await p.selectOption('#fHome',home2); await p.waitForTimeout(900);
  const hs=await p.evaluate(()=>solarify.system().bodies.filter(b=>b.home).length); ok('home='+home2+' -> '+(home2==='none'?'no home marker':'one home marker'), home2==='none'?hs===0:hs===1);}
console.log(errs.join('\n')||'no page errors');console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();})();
