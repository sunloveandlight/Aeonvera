import { loadEnv } from './_qa_env.mjs'; loadEnv();
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
const uid='81645974-6bfd-40e8-a181-fbadab730f47';
const tier=process.argv[2]; // core|elite|sovereign|free
const patch = tier==='free' ? {plan:null, subscription_status:null} : {plan:tier, subscription_status:'active'};
const { data, error } = await admin.from('profiles').update(patch).eq('user_id', uid).select('plan,subscription_status');
console.log(tier, error? ('ERR '+error.message) : JSON.stringify(data));
