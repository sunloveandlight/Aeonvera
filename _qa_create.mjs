import { loadEnv } from './_qa_env.mjs';
loadEnv();
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});
const email = `qa-visual-audit-2026@aeonvera-qa.test`;
const password = `QaVisual!${'x'}9aZ72k`;
// clean any prior
const { data: list } = await admin.auth.admin.listUsers({ page:1, perPage:200 });
const prior = list?.users?.find(u=>u.email===email);
if(prior){ await admin.auth.admin.deleteUser(prior.id); console.log('deleted prior', prior.id); }
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm:true });
if(error){ console.log('CREATE ERROR', error.message); process.exit(1); }
console.log('CREATED', data.user.id, email);
console.log('CREDS', JSON.stringify({email,password}));
