import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

async function test() {
  const { data: profiles } = await supabase.from('profiles').select('id, name, email, wallet_balance, is_admin');
  console.log('All registered profiles in DB:', profiles);
}

test();
