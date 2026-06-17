import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}, storageState:'/tmp/aeon-session.json'});
const pg=await ctx.newPage();
await pg.goto('http://localhost:3000/assessment',{waitUntil:'networkidle'});
await pg.waitForTimeout(900);
async function fillStep(){
  // number inputs
  const nums = await pg.$$('input[type=number]');
  for(const n of nums){ const v=await n.inputValue(); if(!v){ const ph=await n.getAttribute('placeholder'); await n.fill(ph && /^[0-9.]+$/.test(ph)? ph : '50'); } }
  // text inputs (non-search)
  const texts = await pg.$$('input[type=text]');
  for(const t of texts){ const v=await t.inputValue(); if(!v){ await t.fill('None'); } }
  // radio groups: check first option per name
  const radios = await pg.$$('input[type=radio]');
  const seen=new Set();
  for(const r of radios){ const name=await r.getAttribute('name'); if(name && seen.has(name)) continue; if(name) seen.add(name);
    const checked = await r.isChecked(); if(!checked){ try{ await r.check({force:true}); }catch(e){} } }
  // selects
  const sels = await pg.$$('select');
  for(const s of sels){ const v=await s.inputValue(); if(!v){ const opts=await s.$$('option'); if(opts.length>1){ const val=await opts[1].getAttribute('value'); if(val) await s.selectOption(val); } } }
  await pg.waitForTimeout(250);
}
let done=false;
for(let step=1; step<=12; step++){
  await fillStep();
  await pg.screenshot({path:`/tmp/aeon-shots/assess-step-${step}.png`});
  const labels = await pg.$$eval('button', bs=>bs.map(b=>b.innerText.trim()).filter(Boolean));
  const finalBtn = labels.find(l=>/build my profile|build profile|generate|see my|create my profile|finish/i.test(l));
  if(finalBtn){ await pg.click(`button:has-text("${finalBtn}")`); console.log(`step ${step}: FINAL "${finalBtn}"`); done=true; break; }
  const cont = labels.find(l=>/^continue$|^next$/i.test(l));
  if(cont){ await pg.click(`button:has-text("${cont}")`); }
  else { console.log(`step ${step}: stuck. labels=${JSON.stringify(labels)}`); break; }
  await pg.waitForTimeout(1100);
  // detect validation error
  const err = await pg.$$eval('*', els=>els.filter(e=>/please complete/i.test(e.textContent||'')&&e.children.length===0).map(e=>e.textContent.trim())).catch(()=>[]);
  if(err.length){ console.log(`step ${step}: VALIDATION ${JSON.stringify(err[0])}`); }
}
await pg.waitForTimeout(9000);
await pg.screenshot({path:`/tmp/aeon-shots/assess-done.png`});
console.log('final URL:', pg.url());
await ctx.storageState({path:'/tmp/aeon-session.json'});
await b.close();
