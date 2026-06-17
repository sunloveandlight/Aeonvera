import { chromium } from 'playwright';
const email='qa-visual-audit-2026@aeonvera-qa.test', password='QaVisual!x9aZ72k';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}, storageState: undefined});
const pg=await ctx.newPage();
await pg.goto('http://localhost:3000/login',{waitUntil:'networkidle'});
await pg.waitForTimeout(600);
await pg.fill('input[type=email], input[placeholder=Email i]', email).catch(()=>{});
// password field
const pw = await pg.$('input[type=password]');
if(pw) await pw.fill(password);
await pg.waitForTimeout(200);
// click sign in
await pg.click('button:has-text("Sign in"), button:has-text("SIGN IN")').catch(()=>{});
await pg.waitForTimeout(3500);
console.log('after login URL:', pg.url());
// dump visible inputs/labels/buttons on landing page
const dump = await pg.evaluate(()=>{
  const inputs=[...document.querySelectorAll('input,select,textarea')].map(el=>({tag:el.tagName,type:el.type,name:el.name,ph:el.placeholder,label:(el.labels&&el.labels[0]?.innerText)||'',req:el.required}));
  const btns=[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean);
  const h=[...document.querySelectorAll('h1,h2')].map(x=>x.innerText.trim()).slice(0,5);
  return {inputs:inputs.slice(0,30),btns:btns.slice(0,15),h};
});
console.log(JSON.stringify(dump,null,2));
// save session for reuse
await ctx.storageState({ path: '/tmp/aeon-session.json' });
await b.close();
