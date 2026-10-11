// Solarify browser check: details-travel. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:1366,height:900}})).newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto(BASE+'/index.html');await p.waitForTimeout(3000);
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
const facts=()=>p.$eval('#facts',e=>e.innerText); const tf=()=>p.$eval('#travelFacts',e=>e.innerText);
// Sol
ok('travel row hidden for the Sun', await p.$eval('#travelRow',e=>e.hidden));
await p.click('#bodyList .action[data-id="earth"]'); await p.waitForTimeout(600);
ok('travel row shows for Earth', !(await p.$eval('#travelRow',e=>e.hidden)));
await p.selectOption('#travelTo','mars'); await p.waitForTimeout(500);
const t1=await tf(); ok('Earth to Mars Hohmann 2.9 + 2.6 = 5.6 km/s, about 259 days', /2[.,]9 \+ 2[.,]6 = 5[.,]6 km\/s/.test(t1) && /25[89][.,]\d days/.test(t1), t1.replace(/\n/g,' | '));
ok('light delay and constant-thrust lines are filled', /min|seconds|h /.test(t1) && /(hours|days)/.test(t1.split('1 g')[1]||''));
const l1=await p.$eval('#travelFacts .live',e=>e.textContent); await p.waitForTimeout(1500); const l2=await p.$eval('#travelFacts .live',e=>e.textContent);
ok('light delay updates as time runs', l1!==l2, l1+' / '+l2);
await p.click('#bodyList .action[data-id="jupiter"]'); await p.waitForTimeout(500);
ok('Jupiter shows Trojans in our system', /Trojan asteroids/.test(await facts()));
ok('Trojan swarms drawn for Jupiter (two point clouds)', (await p.evaluate(()=>solarify.system().trojanSwarms))===2);
// built system
await p.evaluate(()=>solarify.build({star:'G',inner:4,outer:3,belts:1,moonsInner:2,moonsOuter:3,home:'hz',age:46,giants:'c',companion:'n',seed:4242}));
await p.waitForTimeout(1800);
ok('built system draws two swarms per planet with Trojans', await p.evaluate(()=>{const y=solarify.system(); return y.trojanSwarms===2*y.bodies.filter(b=>b.trojans).length;}), String(await p.evaluate(()=>solarify.system().trojanSwarms)));
await p.click('#bodyList .action[data-id="p3"]'); await p.waitForTimeout(500);
const f3=await facts();
ok('rocky planet shows escape velocity, gases, magnetic field, sky, Hill and Roche', ['Escape velocity','Can hold on to','Magnetic field','Sky','Hill sphere','Roche limit'].every(k=>f3.includes(k)), f3.split('\n').filter(l=>/Escape|hold|Magnetic|Sky|Hill|Roche/.test(l)).join(' | '));
ok('no NaN or undefined in the panel', !/NaN|undefined|Infinity/.test(f3+await tf()));
ok('subscripts used for gas formulas', /N₂|O₂|CO₂|H₂O/.test(f3));
await p.click('#bodyList .action[data-id="p6"]'); await p.waitForTimeout(500);
const f6=await facts(); ok('giant shows cloud-top escape velocity and Hill sphere', /cloud tops/.test(f6) && /Hill sphere/.test(f6));
ok('travel from a giant lists the other planets, not itself', await p.$$eval('#travelTo option',o=>o.every(x=>x.value!=='p6') && o.length>=5));
// moon travels as its planet
const moonId=await p.evaluate(()=>solarify.system().bodies.find(b=>b.parent==='p6').id);
await p.click('#moonList .action[data-id="'+moonId+'"]'); await p.waitForTimeout(500);
ok('a moon gets the travel panel, travelling as its planet', !(await p.$eval('#travelRow',e=>e.hidden)) && await p.$$eval('#travelTo option',o=>o.every(x=>x.value!=='p6')));
// keep destination across selections
await p.click('#bodyList .action[data-id="p2"]'); await p.waitForTimeout(300); await p.selectOption('#travelTo','p5'); await p.waitForTimeout(300);
await p.click('#bodyList .action[data-id="p3"]'); await p.waitForTimeout(300);
ok('destination kept when selecting another planet', (await p.$eval('#travelTo',e=>e.value))==='p5');
console.log(errs.join('\n')||'no page errors'); console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;
await p.click('#bodyList .action[data-id="p3"]'); await p.evaluate(()=>document.getElementById('travelRow').scrollIntoView()); await p.waitForTimeout(400); await p.screenshot({path:TMP+'/travel.png'});
await b.close();})();
