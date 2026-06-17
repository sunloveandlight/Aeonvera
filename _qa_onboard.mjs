import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}, storageState:'/tmp/aeon-session.json'});
const pg=await ctx.newPage();
await pg.goto('http://localhost:3000/onboarding',{waitUntil:'networkidle'});
await pg.waitForTimeout(800);
if(pg.url().includes('/onboarding')){
  const tb=await pg.$$('input[type=text]');
  if(tb[0]) await tb[0].fill('Avery Quinn');
  if(tb[1]) await tb[1].fill('Personal');
  const cb=await pg.$('input[type=checkbox]'); if(cb) await cb.check();
  await pg.waitForTimeout(200);
  await pg.click('button:has-text("COMPLETE SETUP"), button:has-text("Complete setup")').catch(e=>console.log('click err',e.message));
  await pg.waitForTimeout(4000);
}
console.log('landing URL:', pg.url());
const dump = await pg.evaluate(()=>{
  const inputs=[...document.querySelectorAll('input,select,textarea')].map(el=>({type:el.type||el.tagName,ph:el.placeholder,label:(el.labels&&el.labels[0]?.innerText)||'',opts:el.tagName==='SELECT'?[...el.options].map(o=>o.value).slice(0,6):undefined}));
  const btns=[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean);
  const h=[...document.querySelectorAll('h1,h2,h3')].map(x=>x.innerText.trim()).slice(0,6);
  return {count:inputs.length, inputs:inputs.slice(0,40), btns:btns.slice(0,20), h};
});
console.log(JSON.stringify(dump,null,2));
await ctx.storageState({ path:'/tmp/aeon-session.json' });
await b.close();
