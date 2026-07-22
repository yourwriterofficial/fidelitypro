import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// Local fallback store directory
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LINKS_FILE = path.join(DATA_DIR, 'telegram_links.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify({}), 'utf8');
  }
}

function getLocalLinks(): Record<string, any> {
  ensureDataDir();
  try {
    const content = fs.readFileSync(LINKS_FILE, 'utf8');
    return JSON.parse(content || '{}');
  } catch (err) {
    return {};
  }
}

function setLocalLink(telegramId: number, linkData: any) {
  const links = getLocalLinks();
  links[telegramId.toString()] = linkData;
  ensureDataDir();
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
}

export async function getProfileByTelegramId(telegramId: number) {
  // 1. Try querying settings table for link
  try {
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `tg_link_${telegramId}`)
      .maybeSingle();

    if (setting?.value) {
      const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
      if (parsed?.userId || parsed?.email) {
        let query = supabase.from('profiles').select('*');
        if (parsed.userId && !parsed.userId.startsWith('tg_')) {
          query = query.eq('id', parsed.userId);
        } else {
          query = query.ilike('email', parsed.email);
        }

        const { data: profile } = await query.maybeSingle();
        if (profile) return profile;

        // Return virtual profile if created via Telegram
        if (parsed.profile) return parsed.profile;
      }
    }
  } catch (err) {
    // Ignore settings error
  }

  // 2. Check local fallback file
  const localLinks = getLocalLinks();
  const localData = localLinks[telegramId.toString()];
  if (localData) {
    if (localData.userId && !localData.userId.startsWith('tg_')) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', localData.userId).maybeSingle();
      if (profile) return profile;
    } else if (localData.email) {
      const { data: profile } = await supabase.from('profiles').select('*').ilike('email', localData.email).maybeSingle();
      if (profile) return profile;
    }

    if (localData.profile) return localData.profile;
  }

  // 3. Direct column query fallback
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (data) return data;
  } catch (err) {
    // column might not exist
  }

  return null;
}

export async function linkTelegramId(email: string, telegramId: number, username?: string) {
  const cleanEmail = email.trim().toLowerCase();

  // Find existing user profile in Supabase by email
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', cleanEmail)
    .maybeSingle();

  let targetProfile = userProfile;

  if (!targetProfile) {
    // Create virtual Telegram user profile
    const displayName = cleanEmail.split('@')[0];
    const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    targetProfile = {
      id: `tg_${telegramId}`,
      email: cleanEmail,
      name: formattedName,
      wallet_balance: 0,
      is_admin: false,
      banned: false,
      created_at: new Date().toISOString(),
    };
  }

  const linkPayload = {
    userId: targetProfile.id,
    email: targetProfile.email,
    username: username || '',
    profile: targetProfile,
    linkedAt: new Date().toISOString(),
  };

  // 1. Save in Supabase settings table
  try {
    await supabase.from('settings').upsert({
      key: `tg_link_${telegramId}`,
      value: JSON.stringify(linkPayload),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to save link in settings table:', err);
  }

  // 2. Save in local backup file
  setLocalLink(telegramId, linkPayload);

  // 3. Attempt profile column update if column exists and real profile exists
  if (userProfile) {
    try {
      await supabase
        .from('profiles')
        .update({ telegram_id: telegramId, telegram_username: username || null })
        .eq('id', userProfile.id);
    } catch (err) {
      // optional column fallback
    }
  }

  return { success: true, profile: targetProfile };
}

export async function getActiveProducts() {
  const { data } = await supabase.from('products').select('*').eq('status', 'active');
  return data || [];
}

export async function getActiveStakingProducts() {
  const { data } = await supabase.from('staking_products').select('*').eq('status', 'active');
  return data || [];
}

export async function getActiveProperties() {
  const { data } = await supabase.from('properties').select('*').in('status', ['active', 'sold']);
  return data || [];
}

export async function getUserOrders(userId: string) {
  if (userId.startsWith('tg_')) {
    return { orders: [], stakings: [], properties: [] };
  }
  const { data: orders } = await supabase.from('orders').select('*').eq('user_id', userId);
  const { data: stakings } = await supabase.from('staking_orders').select('*').eq('user_id', userId);
  const { data: properties } = await supabase.from('property_investments').select('*, property:property_id(title)').eq('user_id', userId);
  return { orders: orders || [], stakings: stakings || [], properties: properties || [] };
}

export async function createInvestmentOrder(userId: string, productId: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();

  if (!profile || !product) return { success: false, message: 'Product or Profile not found.' };
  if ((profile.wallet_balance || 0) < product.min_amount) {
    return { success: false, message: `Insufficient wallet balance. Minimum required is $${product.min_amount}.` };
  }

  const amount = product.min_amount;
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + product.duration_days * 86400000).toISOString();

  await supabase.from('profiles').update({ wallet_balance: (profile.wallet_balance || 0) - amount }).eq('id', userId);

  const { error: orderErr } = await supabase.from('orders').insert({
    user_id: userId,
    product_id: product.id,
    product_name: product.name,
    amount,
    daily_return: product.daily_return,
    duration_days: product.duration_days,
    start_date: startDate,
    end_date: endDate,
    status: 'active',
  });

  if (orderErr) {
    await supabase.from('profiles').update({ wallet_balance: profile.wallet_balance }).eq('id', userId);
    return { success: false, message: 'Failed to create investment.' };
  }

  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'investment',
    amount,
    description: `Investment in ${product.name}`,
    status: 'completed',
  });

  return { success: true, message: `Successfully invested $${amount} in ${product.name}!` };
}

export async function approveDeposit(depositId: string, adminId: string) {
  const { data: deposit } = await supabase.from('deposits').select('*').eq('id', depositId).single();
  if (!deposit || deposit.status !== 'pending') return { success: false, message: 'Deposit not pending.' };

  await supabase.from('deposits').update({ status: 'approved' }).eq('id', depositId);

  const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', deposit.user_id).single();
  const newBalance = (profile?.wallet_balance || 0) + deposit.amount;
  await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', deposit.user_id);

  await supabase.from('transactions').insert({
    user_id: deposit.user_id,
    type: 'deposit',
    amount: deposit.amount,
    description: `Deposit via ${deposit.payment_method} approved`,
    status: 'completed',
  });

  return { success: true, amount: deposit.amount, userId: deposit.user_id };
}

export async function rejectDeposit(depositId: string) {
  const { data: deposit } = await supabase.from('deposits').select('*').eq('id', depositId).single();
  if (!deposit || deposit.status !== 'pending') return { success: false, message: 'Deposit not pending.' };

  await supabase.from('deposits').update({ status: 'rejected' }).eq('id', depositId);
  return { success: true, userId: deposit.user_id };
}

export async function approveWithdrawal(withdrawalId: string) {
  const { data: withdrawal } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
  if (!withdrawal || withdrawal.status !== 'pending') return { success: false, message: 'Withdrawal not pending.' };

  await supabase.from('withdrawals').update({ status: 'approved' }).eq('id', withdrawalId);

  await supabase.from('transactions').insert({
    user_id: withdrawal.user_id,
    type: 'withdrawal',
    amount: withdrawal.amount,
    description: `Withdrawal of $${withdrawal.amount} to ${withdrawal.wallet_address} approved`,
    status: 'completed',
  });

  return { success: true, amount: withdrawal.amount, userId: withdrawal.user_id };
}

export async function rejectWithdrawal(withdrawalId: string) {
  const { data: withdrawal } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
  if (!withdrawal || withdrawal.status !== 'pending') return { success: false, message: 'Withdrawal not pending.' };

  await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', withdrawalId);

  const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', withdrawal.user_id).single();
  const restoredBalance = (profile?.wallet_balance || 0) + withdrawal.amount;
  await supabase.from('profiles').update({ wallet_balance: restoredBalance }).eq('id', withdrawal.user_id);

  return { success: true, userId: withdrawal.user_id };
}
