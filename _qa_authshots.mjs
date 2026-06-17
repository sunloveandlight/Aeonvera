import { chromium } from 'playwright';
const tier=process.argv[2]||'tier';
const pages=[['dashboard','/dashboard'],['companion','/companion'],['digitaltwin','/digital-twin'],['optimization','/optimization'],['lifeos','/life-os'],['memory','/memory'],['network','/network'],['datasources','/data-sources'],['plan','/plan'],['report','/report'],['settings','/settings'],['physicianexport','/physician-export']];
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900}, storageState:'/tmp/aeon-session.json'});
const pg=await ctx.newPage();
async function slices(label,path){
  try{
    const r=await pg.goto('http://localhost:3000'+path,{waitUntil:'networkidle',timeout:30000});
    await pg.waitForTimeout(2500);
    const url=pg.url();
    const h=await pg.evaluate(()=>document.body.scrollHeight);
    const step=840, n=Math.min(4,Math.max(1,Math.ceil(h/step)));
    for(let i=0;i<n;i++){ await pg.evaluate(y=>{document.body.scrollTop=y;window.scrollTo(0,y);}, i*step); await pg.waitForTimeout(500); await pg.screenshot({path:`/tmp/aeon-shots/${tier}-${label}-${i+1}.png`}); }
    console.log(`${tier}/${label}: ${r?.status()} url=${url} h=${h} n=${n}`);
  }catch(e){ console.log(`${tier}/${label}: ERROR ${e.message}`);} }
for(const [l,p] of pages) await slices(l,p);
await b.close(); console.log('DONE');
