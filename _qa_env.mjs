import fs from 'fs';
export function loadEnv(){
  const txt = fs.readFileSync('.env.local','utf8');
  for(const line of txt.split('\n')){
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if(m){ let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); process.env[m[1]]=v; }
  }
}
