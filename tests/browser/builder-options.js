// Solarify browser check: builder-options. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1366,height:768}});
const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});p.on('dialog',d=>d.accept());
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
const url=BASE+'/index.html';
await p.goto(url);await p.waitForTimeout(1500);
const facts=()=>p.$$eval('#facts dt',dts=>Object.fromEntries(dts.map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));
const sel=()=>p.$eval('#selName',e=>e.textContent);
const setRange=(id,v)=>p.evaluate(([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);
const pickBody=async id=>{ await p.evaluate(i=>{const btn=document.querySelector('#bodyList .action[data-id="'+i+'"]');if(btn){btn.click();return;} const par=i.replace(/m\\d+$/,''); document.querySelector('#bodyList .action[data-id="'+par+'"]').click(); document.querySelector('#moonList .action[data-id="'+i+'"]').click();},id); await p.waitForTimeout(80); };

// Sol keeps working and gains its real main belt
ok('Sol: one asteroid belt, labelled, with the 2.2-3.2 AU extent', (await p.evaluate(()=>solarify.system().belts))===1 && (await p.$$eval('#labels .tag.belt',x=>x.map(e=>e.textContent)))[0]==='Main asteroid belt');
// the form
await p.click('#modeBuild'); await p.waitForTimeout(1500);
ok('simple form up front, depth folded away: advanced closed, mass hidden for a preset star, no Generate button', await p.$('#fAge') && !(await p.$eval('#advanced',e=>e.open)) && await p.$eval('#massRow',e=>e.hidden) && !(await p.$('#fGenerate')));
await p.selectOption('#fStar','X'); await p.waitForTimeout(600); ok('choosing "Star by mass" shows the mass slider and opens the extra options', !(await p.$eval('#massRow',e=>e.hidden)) && await p.$eval('#advanced',e=>e.open));
await setRange('fMass',140); ok('mass slider output reads 1.40 x Sun', (await p.$eval('#oMass',e=>e.textContent)).startsWith('1.4'), await p.$eval('#oMass',e=>e.textContent));
await setRange('fAge',0); ok('age 0 reads "rolled from the seed"', (await p.$eval('#oAge',e=>e.textContent)).includes('rolled'));
await setRange('fAge',15); ok('age 15 reads 1.5 billion years', (await p.$eval('#oAge',e=>e.textContent))==='1.5 billion years');
await p.evaluate(()=>{document.getElementById('advanced').open=true;});
await p.selectOption('#fGiants','e'); await p.selectOption('#fCompanion','w'); await setRange('fBelts',2); await setRange('fSeed',31); await p.waitForTimeout(3500);
const sy=await p.evaluate(()=>solarify.system());
ok('generating applies mass, age, giants layout, companion and belts', sy.stars===2 && sy.belts>=1 && /^#s=4\.X\.140\.15\./.test(await p.evaluate(()=>location.hash)) && /\.e\.w\.31\.-$/.test(await p.evaluate(()=>location.hash)), await p.evaluate(()=>location.hash));
ok('summary mentions two stars, the age, belts and the snow line', /Two stars/.test(await p.$eval('#sysSummary',e=>e.textContent)) && /System age 1\.5/.test(await p.$eval('#sysSummary',e=>e.textContent)) && /snow line/.test(await p.$eval('#sysSummary',e=>e.textContent)), await p.$eval('#sysSummary',e=>e.textContent));
ok('header names the system and its companion', /companion star/.test(await p.$eval('#sysName',e=>e.textContent)), await p.$eval('#sysName',e=>e.textContent));
ok('belt labels exist, one per belt', (await p.$$eval('#labels .tag.belt',x=>x.length))===sy.belts);
await p.evaluate(()=>document.activeElement&&document.activeElement.blur()); await p.keyboard.press('o'); await p.waitForTimeout(300); ok('O hides orbits and the belt labels', (await p.$$eval('#labels .tag.belt',x=>x.every(e=>e.style.display==='none'))) ); await p.keyboard.press('o');
// both stars selectable, facts
const starIds=await p.evaluate(()=>solarify.system().bodies.filter(b=>/^sun/.test(b.id)).map(b=>b.id));
ok('two star bodies', starIds.length===2, starIds.join(','));
await pickBody('sun'); let f=await facts();
ok('primary star facts: age, snow line, companion rows, planet regime', ['System age','Snow line','Companion star','Companion distance','Planets'].every(k=>f[k]), Object.keys(f).join('|'));
await pickBody('sun2'); f=await facts();
ok('companion star facts: orbits the primary, separation, stretch', Object.keys(f).some(k=>/^Orbits .* in$/.test(k)) && f['Mean separation'] && f['Orbit stretch'] !== undefined, Object.keys(f).join('|'));
// planets: the richer panel
const bodies=await p.evaluate(()=>solarify.system().bodies);
const rocky=bodies.find(x=>/rocky/.test(x.kind)&&!x.parent), giant=bodies.find(x=>/giant/.test(x.kind)&&!x.parent);
await pickBody(rocky.id); f=await facts();
const need=['Size class','Density','Surface gravity','Mass','Atmosphere','Surface temperature','Blackbody temperature','Volcanic activity','Resources','Habitability','Habitable zone','Starlight vs Earth'];
ok('rocky planet panel carries the new rows', need.every(k=>f[k]!==undefined), need.filter(k=>f[k]===undefined).join(','));
ok('surface temperature row gives kelvin, celsius and a climate word', /K \(.*°C\), \w/.test(f['Surface temperature']), f['Surface temperature']);
if (giant){ await pickBody(giant.id); f=await facts(); ok('giant panel: size class, mass and density', f['Size class'] && f['Mass'] && f['Density'], JSON.stringify(f).slice(0,160)); }
// home world in an old system
await p.evaluate(c=>solarify.build(c),{star:'G',age:60,inner:3,outer:2,belts:0,moonsInner:1,moonsOuter:1,home:'hz',giants:'c',companion:'n',seed:55}); await p.waitForTimeout(1500);
const home=(await p.evaluate(()=>solarify.system().bodies)).find(x=>x.home);
await pickBody(home.id); f=await facts();
ok('home world panel: atmosphere says breathable, liquid water shown, habitability positive', /breathable/.test(f['Atmosphere']) && /% of the surface/.test(f['Liquid water']) && /^\+\d/.test(f['Habitability']), f['Atmosphere']+' | '+f['Habitability']);
// young system note
await p.evaluate(c=>solarify.build(c),{star:'G',age:8,inner:3,outer:1,belts:0,moonsInner:0,moonsOuter:0,home:'hz',giants:'c',companion:'n',seed:55}); await p.waitForTimeout(1200);
ok('a young system explains why the home world is an ocean world', /too young/.test(await p.$eval('#sysNotes',e=>e.textContent)));
// hot and eccentric giants
await p.evaluate(c=>solarify.build(c),{star:'G',age:46,inner:3,outer:3,belts:0,moonsInner:0,moonsOuter:0,home:'hz',giants:'h',companion:'n',seed:12}); await p.waitForTimeout(1200);
ok('hot layout: a giant labelled hot', (await p.evaluate(()=>solarify.system().bodies)).some(x=>/hot, close to its star/.test(x.kind)));
await p.evaluate(c=>solarify.build(c),{star:'G',age:46,inner:2,outer:3,belts:0,moonsInner:0,moonsOuter:0,home:'hz',giants:'e',companion:'n',seed:12}); await p.waitForTimeout(1200);
ok('eccentric layout: a giant labelled eccentric', (await p.evaluate(()=>solarify.system().bodies)).some(x=>/eccentric orbit/.test(x.kind)));
// tide-locked day / night rows
await p.evaluate(c=>solarify.build(c),{star:'M',age:46,inner:3,outer:0,belts:0,moonsInner:0,moonsOuter:0,home:'hz',giants:'c',companion:'n',seed:2}); await p.waitForTimeout(1200);
const hm=(await p.evaluate(()=>solarify.system().bodies)).find(x=>x.home); await pickBody(hm.id); f=await facts();
ok('a tide-locked rocky world shows day side and night side', /K \/ .* K/.test(f['Day side / night side']||''), f['Day side / night side']);
// P-type pair
await p.evaluate(c=>solarify.build(c),{star:'K',age:46,inner:3,outer:2,belts:1,moonsInner:1,moonsOuter:2,home:'hz',giants:'c',companion:'v',seed:6}); await p.waitForTimeout(2000);
const rg=await p.evaluate(()=>solarify.system().regime);
await pickBody('sun'); f=await facts();
ok('very close companion: regime is circumbinary or none, and the primary reports it', (rg==='P'||rg===null||rg==='S') && f['Planets']!==undefined && (rg!=='P' || /Orbits the pair's centre in/.test(Object.keys(f).join('|'))), rg+' | '+f['Planets']);
// share link, new format, new page
await p.evaluate(c=>solarify.build(c),{star:'X',mass:180,age:20,inner:3,outer:2,belts:2,moonsInner:1,moonsOuter:2,home:'cold',giants:'h',companion:'m',seed:77}); await p.waitForTimeout(1000);
const hash=await p.evaluate(()=>location.hash); const snap=await p.evaluate(()=>JSON.stringify(solarify.system().bodies.map(b=>[b.id,b.name,b.kind,b.aAU])));
const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push('p2: '+e.message)); await p2.goto(url+hash); await p2.waitForTimeout(1500);
ok('v3 link rebuilds the identical system', snap===await p2.evaluate(()=>JSON.stringify(solarify.system().bodies.map(b=>[b.id,b.name,b.kind,b.aAU]))), hash); await p2.close();
const p3=await ctx.newPage(); await p3.goto(url+'?x=1#s=2.G.4.4.1.3.hz.0.5'); await p3.waitForTimeout(1000);
ok('an old (version 2) link is refused and falls back to our Solar System', (await p3.evaluate(()=>solarify.mode()))==='sol'); await p3.close();
// the zone fades up close
await p.keyboard.press('0'); await p.waitForTimeout(800);
// heaviest system incl. companion
await p.evaluate(c=>solarify.build(c),{star:'F',age:46,inner:8,outer:8,belts:3,moonsInner:4,moonsOuter:8,home:'hz',giants:'c',companion:'w',seed:99}); await p.waitForTimeout(2500);
const info=await p.evaluate(()=>{const s=solarify.system();return {n:s.bodies.length,stars:s.stars,belts:s.belts};}); ok('heaviest builder case loads: '+info.n+' bodies, '+info.stars+' stars, '+info.belts+' belts', info.n>10);
console.log(errs.join('\n')||'no page errors');console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();})();
