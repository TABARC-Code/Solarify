// Solarify browser check: textures. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1366,height:768}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/index.html');await p.waitForFunction(()=>window.solarify);
let ok=0,fail=0;const t=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));c?ok++:fail++;};
const sizes=()=>p.evaluate(()=>solarify.textureSizes());
const t0=Date.now();let s;
for(;;){s=await sizes();if(Object.values(s).every(v=>v>=512)||Date.now()-t0>60000)break;await p.waitForTimeout(500);}
t('all ten bodies get a 512 px texture', Object.values(s).every(v=>v===512), ((Date.now()-t0)/1000).toFixed(1)+' s in this slow software-3D sandbox: '+JSON.stringify(s));
t('nobody got the sharp version without being selected', Object.values(s).every(v=>v<1024));
await p.keyboard.press('5');                           // Jupiter, close up
const t1=Date.now();for(;;){s=await sizes();if(s.jupiter>=1024||Date.now()-t1>30000)break;await p.waitForTimeout(300);}
t('selecting Jupiter builds its sharp 1024 px texture', s.jupiter===1024, ((Date.now()-t1)/1000).toFixed(1)+' s');
t('...and only Jupiter', Object.keys(s).filter(k=>s[k]===1024).join()==='jupiter', JSON.stringify(s));
// a late-queued body selected early should jump the queue
await p.goto(BASE+'/index.html');await p.waitForFunction(()=>window.solarify);
await p.keyboard.press('8');                           // Neptune is last in the queue
const t2=Date.now();for(;;){s=await sizes();if(s.neptune>=512||Date.now()-t2>20000)break;await p.waitForTimeout(200);}
const others=Object.keys(s).filter(k=>k!=='neptune'&&s[k]>0).length;
t('Neptune, picked straight away, jumps the queue', s.neptune>=512 && others<9, 'Neptune ready after '+((Date.now()-t2)/1000).toFixed(1)+' s with only '+others+' of the other 9 done');
console.log(errs.join('\n')||'no errors');console.log(fail?fail+' FAILED':'ALL PASSED');process.exitCode=fail?1:0;await b.close();})();
