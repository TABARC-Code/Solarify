// Solarify browser check: project-files. Run all of them with: node tests/browser/run.js
const { chromium, BASE, TMP } = require('./harness');
const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true});
const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
let dialogs=0;p.on('dialog',d=>{dialogs++;d.accept();});
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(x?'  ['+x+']':''));if(!c)fails++;};
const url=BASE+'/index.html';
await p.goto(url);await p.waitForTimeout(1500);
// helper: synthesise a drag-and-drop of N coloured images at a point
const dragAt=(x,y,colours,doDrop=true,id=null)=>p.evaluate(async([x,y,colours,doDrop,id])=>{
  const dt=new DataTransfer();
  for (let i=0;i<colours.length;i++){const c=document.createElement('canvas');c.width=64;c.height=32;const g=c.getContext('2d');g.fillStyle=colours[i];g.fillRect(0,0,64,32);const blob=await new Promise(r=>c.toBlob(r,'image/png'));dt.items.add(new File([blob],'img'+i+'.png',{type:'image/png'}));}
  if (id){ const sp=solarify.screenOf(id); x=sp.x; y=sp.y; }
  window.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  const hint=document.getElementById('dropHint'); const info={hidden:hint.hidden,text:hint.textContent};
  if (doDrop) window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  return info;},[x,y,colours,doDrop,id]);
await p.click('#modeBuild'); await p.waitForTimeout(2000);
await p.evaluate(c=>solarify.build(c),{star:'G',age:46,inner:4,outer:3,belts:1,moonsInner:1,moonsOuter:2,home:'hz',giants:'c',companion:'n',seed:2024}); await p.waitForTimeout(1500);
const sys1=await p.evaluate(()=>solarify.system()); const planets=sys1.bodies.filter(x=>!x.parent&&x.id!=='sun');
// 1. drop on a planet that is NOT selected
await p.keyboard.press('0'); await p.waitForTimeout(1200);
const target=planets[2], pos=await p.evaluate(id=>solarify.screenOf(id),target.id);
const info=await dragAt(0,0,['#ff29ff'],true,target.id); await p.waitForTimeout(800);
ok('dragging over a planet names it in the drop hint', info.hidden===false && info.text==='Drop to dress '+target.name, info.text);
ok('dropping on a planet dresses THAT planet and selects it', (await p.evaluate(id=>solarify.hasMap(id),target.id)) && (await p.$eval('#selName',e=>e.textContent)).startsWith(target.name), await p.$eval('#selName',e=>e.textContent));
ok('the hint disappears after the drop', await p.$eval('#dropHint',e=>e.hidden));
ok('time paused during the drag and resumed after the drop', await p.evaluate(()=>solarify.state.paused)===false);
// 2. drop in empty space dresses the selected body
await p.keyboard.press('0'); await p.waitForTimeout(500);
await dragAt(40,700,['#29ffff'],true); await p.waitForTimeout(600);
ok('dropping in empty space dresses the selected body (the star)', await p.evaluate(()=>solarify.hasMap('sun')));
await p.click('#mapReset'); await p.waitForTimeout(200);
// 3. several images dress several bodies in order
await p.evaluate(()=>{}); const first=planets[0], pos0=await p.evaluate(id=>solarify.screenOf(id),first.id);
const before=await p.evaluate(()=>solarify.maps().length);
await dragAt(0,0,['#ff0000','#00ff00','#0000ff'],true,first.id); await p.waitForTimeout(1200);
const after=await p.evaluate(()=>solarify.maps()); const order=await p.evaluate(()=>solarify.system().bodies.map(b=>b.id));
const i0=order.indexOf(first.id);
ok('three images dress three bodies in order from the one dropped on', [0,1,2].every(k=>after.indexOf(order[i0+k])>=0), after.join(','));
ok('a toast says how many were dressed', /Dressed 3 bodies/.test(await p.$eval('#toast',e=>e.textContent)), await p.$eval('#toast',e=>e.textContent));
ok('a drop never shows a confirm dialog', dialogs===0, String(dialogs));
// 4. images survive rolling, changing settings, and switching to Sol and back
const mapsBefore=(await p.evaluate(()=>solarify.maps())).slice().sort().join(',');
await p.click('#fRoll'); await p.waitForTimeout(1500);
ok('rolling a new system keeps your images on the same planet slots', (await p.evaluate(()=>solarify.maps())).slice().sort().join(',')===mapsBefore && (await p.evaluate(id=>solarify.hasMap(id),first.id)));
await p.selectOption('#fStar','K'); await p.waitForTimeout(1800);
ok('changing the star keeps them too', (await p.evaluate(()=>solarify.maps())).slice().sort().join(',')===mapsBefore && (await p.evaluate(id=>solarify.hasMap(id),first.id)));
await p.click('#modeSol'); await p.waitForTimeout(1500);
ok('our Solar System starts without them and without asking', (await p.evaluate(()=>solarify.maps().length))===0 && dialogs===0);
await p.keyboard.press('4'); await p.waitForTimeout(400); await dragAt(40,700,['#ffaa00'],true); await p.waitForTimeout(600);
ok('dress Mars in our Solar System', await p.evaluate(()=>solarify.hasMap('mars')));
await p.click('#modeBuild'); await p.waitForTimeout(1500);
ok('back in the builder the images are still there', (await p.evaluate(()=>solarify.maps())).slice().sort().join(',')===mapsBefore);
await p.click('#modeSol'); await p.waitForTimeout(1200);
ok('and Mars is still dressed in our Solar System', await p.evaluate(()=>solarify.hasMap('mars')));
// 5. clear all
await p.click('#modeBuild'); await p.waitForTimeout(1200);
await p.evaluate(()=>{document.getElementById('sec-export').open=true;});
ok('Clear all my images is enabled when there are images', !(await p.$eval('#mapsClear',e=>e.disabled)));
await p.click('#mapsClear'); await p.waitForTimeout(400);
ok('Clear all my images removes them and disables itself', (await p.evaluate(()=>solarify.maps().length))===0 && await p.$eval('#mapsClear',e=>e.disabled));
// 6. project file round trip
await dragAt(0,0,['#ff29ff','#29ff29'],true,first.id); await p.waitForTimeout(1000);
const idsDressed=(await p.evaluate(()=>solarify.maps())).slice().sort();
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#projSave')]);
const file=TMP+'/proj.json'; await dl.saveAs(file);
const proj=JSON.parse(fs.readFileSync(file,'utf8'));
ok('project file: app, version, mode, a v4 link, and the images as data URLs', proj.app==='solarify' && proj.version===1 && proj.mode==='custom' && /^4\./.test(proj.link) && proj.maps.length===2 && proj.maps.every(m=>/^data:image\/jpeg;base64,/.test(m.data)), dl.suggestedFilename()+' '+proj.link);
const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push('p2 '+e.message)); await p2.goto(url); await p2.waitForTimeout(1500);
await p2.setInputFiles('#projFile',file); await p2.waitForTimeout(2500);
ok('opening it in a fresh page rebuilds the same system and restores the images', (await p2.evaluate(()=>solarify.mode()))==='custom' && JSON.stringify((await p2.evaluate(()=>solarify.maps())).slice().sort())===JSON.stringify(idsDressed) && (await p2.evaluate(id=>solarify.hasMap(id),idsDressed[0])));
// 7. hostile and broken files
const bad=async(name,obj)=>{ const f=TMP+'/bad.json'; fs.writeFileSync(f,typeof obj==='string'?obj:JSON.stringify(obj)); const pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(name+' '+e.message)); await pg.goto(url); await pg.waitForTimeout(1200); await pg.setInputFiles('#projFile',f); await pg.waitForTimeout(800); const r={mode:await pg.evaluate(()=>solarify.mode()),maps:await pg.evaluate(()=>solarify.maps().length),toast:await pg.$eval('#toast',e=>e.textContent)}; await pg.close(); return r; };
let r=await bad('garbage','this is not json {{{'); ok('garbage is refused politely', r.mode==='sol' && /not a Solarify project/.test(r.toast), r.toast);
r=await bad('wrongapp',{app:'other',version:1,mode:'sol',maps:[]}); ok('another app\'s JSON is refused', /not a Solarify project/.test(r.toast), r.toast);
r=await bad('oldlink',{app:'solarify',version:1,mode:'custom',link:'2.G.4.4.1.3.hz.0.5',maps:[]}); ok('a project from an older builder is refused with a reason', r.mode==='sol' && /different version/.test(r.toast), r.toast);
r=await bad('svg',{app:'solarify',version:1,mode:'sol',link:null,maps:[{id:'mars',name:'x',data:'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='},{id:'earth',name:'y',data:'javascript:alert(1)'},{id:'venus',name:'z',data:'http://example.com/x.png'}]}); ok('only png, jpeg and webp data URLs are accepted: svg, javascript and http are dropped', r.maps===0, 'maps '+r.maps);
r=await bad('unknownid',{app:'solarify',version:1,mode:'sol',link:null,maps:[{id:'nonexistent',name:'x',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}]}); ok('an image for a body that does not exist is kept harmlessly', r.mode==='sol');
console.log(errs.join('\n')||'no page errors');console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();})();
