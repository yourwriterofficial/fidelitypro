import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { config } from './config.js';
import {
  getProfileByTelegramId,
  linkTelegramId,
  getActiveProducts,
  getActiveStakingProducts,
  getActiveProperties,
  getUserOrders,
  createInvestmentOrder,
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal,
  supabase,
} from './services/supabase.js';

if (!config.telegramBotToken) {
  console.error('❌ Cannot start bot: TELEGRAM_BOT_TOKEN is missing.');
  process.exit(1);
}

export const bot = new Bot(config.telegramBotToken);

// Global Error Handler so bot never crashes
bot.catch((err) => {
  console.error('⚠️ Telegram Bot Handled Error:', err.error);
});

// User state session map for multi-step prompts
const userStates = new Map<number, { action: string; data?: any }>();

// Main Persistent Reply Keyboard
function getMainKeyboard(isAdmin: boolean = false) {
  const kb = new Keyboard()
    .text('📊 Dashboard').text('🚀 Invest').row()
    .text('🔒 Staking').text('🏢 Properties').row()
    .text('💳 Wallet').text('👥 Referrals').row()
    .text('💬 Community').text('📱 Launch Web App').row();

  if (isAdmin) {
    kb.text('⚙️ Admin Panel').row();
  }
  return kb.resized();
}

// ─── COMMAND: /start ────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await getProfileByTelegramId(telegramId);

  if (profile) {
    const isAdmin = profile.is_admin;
    const inlineKb = new InlineKeyboard()
      .webApp('🚀 Open Mini App', config.webAppUrl)
      .row()
      .text('📊 Dashboard', 'nav_dashboard')
      .text('💳 Deposit / Withdraw', 'nav_wallet');

    await ctx.reply(
      `👋 Welcome back, *${profile.name}*!\n\n` +
      `💳 *Wallet Balance:* $${(profile.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `💼 *Status:* ${profile.banned ? '🔴 Restricted' : '🟢 Active Member'}\n\n` +
      `Use the menu below or tap *Open Mini App* to access full trading features inside Telegram!`,
      { parse_mode: 'Markdown', reply_markup: getMainKeyboard(isAdmin) }
    );
    await ctx.reply('⚡ Quick Actions:', { reply_markup: inlineKb });
  } else {
    userStates.set(telegramId, { action: 'awaiting_email' });

    const linkKb = new InlineKeyboard()
      .webApp('🌐 Launch RPM Web App', config.webAppUrl);

    await ctx.reply(
      `👋 Welcome to *RPM* on Telegram!\n\n` +
      `To get started, please link your existing account or open our Mini App:\n\n` +
      `📧 *Reply with your registered Account Email address* below to link your account, or launch the Mini App to create a new profile.`,
      { parse_mode: 'Markdown', reply_markup: linkKb }
    );
  }
});

// ─── COMMAND: /app (Mini App Launcher) ──────────────────────────────────────
bot.command('app', async (ctx) => {
  const inlineKb = new InlineKeyboard().webApp('🚀 Launch RPM Mini App', config.webAppUrl);
  await ctx.reply('Tap below to launch the full RPM / FidelityPro Mini App directly inside Telegram:', {
    reply_markup: inlineKb,
  });
});

// ─── COMMAND: /dashboard ───────────────────────────────────────────────────
bot.command('dashboard', async (ctx) => handleDashboard(ctx));
bot.hears('📊 Dashboard', async (ctx) => handleDashboard(ctx));

async function handleDashboard(ctx: any) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await getProfileByTelegramId(telegramId);
  if (!profile) {
    return ctx.reply('⚠️ Account not linked. Please use /start and enter your email address first.');
  }

  const { orders, stakings, properties } = await getUserOrders(profile.id);

  const totalInvested = orders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
  const totalStaked = stakings.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const totalPropPaid = properties.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);

  const totalReturns = orders.reduce((sum: number, o: any) => {
    return sum + (o.amount * (1 + (o.daily_return / 100) * o.duration_days)) - o.amount;
  }, 0);

  const portfolioVal = (profile.wallet_balance || 0) + totalInvested + totalStaked + totalPropPaid;

  const msg =
    `📊 *Portfolio Overview*\n` +
    `───────────────\n` +
    `👤 *User:* ${profile.name}\n` +
    `💳 *Wallet Balance:* $${(profile.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
    `📈 *Total Portfolio Value:* $${portfolioVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n` +
    `🚀 *Active Investments:* $${totalInvested.toLocaleString()} (${orders.length} plans)\n` +
    `🔒 *Locked Savings (Staking):* $${totalStaked.toLocaleString()} (${stakings.length} pools)\n` +
    `🏢 *Real Estate Holdings:* $${totalPropPaid.toLocaleString()} (${properties.length} shares)\n` +
    `💰 *Projected Returns:* +$${totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;

  const kb = new InlineKeyboard()
    .text('🚀 Invest Now', 'nav_invest')
    .text('🔒 Lock Savings', 'nav_staking')
    .row()
    .text('🏢 View Properties', 'nav_properties')
    .text('💳 Deposit Funds', 'action_deposit');

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /invest ──────────────────────────────────────────────────────
bot.command('invest', async (ctx) => handleInvest(ctx));
bot.hears('🚀 Invest', async (ctx) => handleInvest(ctx));

async function handleInvest(ctx: any) {
  const products = await getActiveProducts();
  if (products.length === 0) {
    return ctx.reply('Currently there are no active investment packages.');
  }

  let msg = `🚀 *High-Yield Investment Plans*\nSelect a plan below to invest using your wallet balance:\n\n`;
  const kb = new InlineKeyboard();

  products.forEach((p: any) => {
    msg += `📦 *${p.name}*\n`;
    msg += `• Daily Return: *${p.daily_return}%*\n`;
    msg += `• Duration: *${p.duration_days} Days*\n`;
    msg += `• Minimum Investment: *$${p.min_amount.toLocaleString()}*\n\n`;

    kb.text(`Invest $${p.min_amount} in ${p.name}`, `buy_prod_${p.id}`).row();
  });

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /staking ─────────────────────────────────────────────────────
bot.command('staking', async (ctx) => handleStaking(ctx));
bot.hears('🔒 Staking', async (ctx) => handleStaking(ctx));

async function handleStaking(ctx: any) {
  const products = await getActiveStakingProducts();
  if (products.length === 0) {
    return ctx.reply('No active locked savings pools available at the moment.');
  }

  let msg = `🔒 *Locked Savings Pools (Staking)*\nEarn fixed returns by locking funds:\n\n`;
  products.forEach((sp: any) => {
    msg += `🛡️ *${sp.name}*\n`;
    msg += `• Total APY / Return: *${sp.return_rate}%*\n`;
    msg += `• Lock Period: *${sp.duration_days} Days*\n`;
    msg += `• Min Amount: *$${sp.min_amount}*\n\n`;
  });

  const kb = new InlineKeyboard().webApp('🔒 Open Staking Portal', `${config.webAppUrl}/app/staking`);
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /properties ──────────────────────────────────────────────────
bot.command('properties', async (ctx) => handleProperties(ctx));
bot.hears('🏢 Properties', async (ctx) => handleProperties(ctx));

async function handleProperties(ctx: any) {
  const properties = await getActiveProperties();
  if (properties.length === 0) {
    return ctx.reply('No real estate listings available right now.');
  }

  let msg = `🏢 *Real Estate Investment Marketplace*\nFractional property ownership:\n\n`;
  properties.slice(0, 5).forEach((prop: any) => {
    msg += `📍 *${prop.title}*\n`;
    msg += `• Location: ${prop.location || 'Prime Location'}\n`;
    msg += `• Share Price: *$${prop.price_per_sqft || prop.target_amount}*\n`;
    msg += `• Est. Rental Yield: *${prop.expected_roi}%/year*\n\n`;
  });

  const kb = new InlineKeyboard().webApp('🏢 Explore All Properties', `${config.webAppUrl}/app/properties`);
  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /wallet ──────────────────────────────────────────────────────
bot.command('wallet', async (ctx) => handleWallet(ctx));
bot.hears('💳 Wallet', async (ctx) => handleWallet(ctx));

async function handleWallet(ctx: any) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await getProfileByTelegramId(telegramId);
  if (!profile) {
    return ctx.reply('⚠️ Account not linked. Use /start to link your account.');
  }

  const msg =
    `💳 *Wallet & Funds*\n` +
    `───────────────\n` +
    `👤 *Account:* ${profile.name} (${profile.email})\n` +
    `💰 *Available Balance:* *$${(profile.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}*\n\n` +
    `Choose an action below:`;

  const kb = new InlineKeyboard()
    .text('📥 Deposit Funds', 'action_deposit')
    .text('📤 Withdraw Funds', 'action_withdraw')
    .row()
    .text('📜 Transaction History', 'action_history');

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /referrals ───────────────────────────────────────────────────
bot.command('referral', async (ctx) => handleReferral(ctx));
bot.hears('👥 Referrals', async (ctx) => handleReferral(ctx));

async function handleReferral(ctx: any) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await getProfileByTelegramId(telegramId);
  if (!profile) {
    return ctx.reply('⚠️ Account not linked. Use /start to link your account.');
  }

  const botUsername = ctx.me.username;
  const refCode = profile.referral_code || profile.id.slice(0, 8);
  const botRefLink = `https://t.me/${botUsername}?start=${refCode}`;
  const webRefLink = `${config.webAppUrl}/signup?ref=${refCode}`;

  const msg =
    `👥 *RPM Partner Program*\n` +
    `Earn high commissions by inviting your network!\n\n` +
    `🔑 *Your Referral Code:* \`${refCode}\` \n\n` +
    `📲 *Telegram Referral Link:*\n\`${botRefLink}\` \n\n` +
    `🌐 *Web Referral Link:*\n\`${webRefLink}\``;

  const kb = new InlineKeyboard().url('🚀 Share Telegram Link', `https://t.me/share/url?url=${encodeURIComponent(botRefLink)}&text=${encodeURIComponent('Join RPM for high daily investment returns!')}`);

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /chat ────────────────────────────────────────────────────────
bot.command('chat', async (ctx) => handleChat(ctx));
bot.hears('💬 Community', async (ctx) => handleChat(ctx));

async function handleChat(ctx: any) {
  const msg =
    `💬 *RPM Community & Support*\n\n` +
    `• Join the *Investor Chat Room* inside the app to discuss market trends and plans with fellow traders!\n` +
    `• Contact 24/7 Support directly via your account inbox.`;

  const kb = new InlineKeyboard()
    .webApp('💬 Join Investor Chat', `${config.webAppUrl}/app/investor-chat`)
    .row()
    .webApp('📩 Support Inbox', `${config.webAppUrl}/app/chat`);

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── COMMAND: /app Button Handler ──────────────────────────────────────────
bot.hears('📱 Launch Web App', async (ctx) => {
  const kb = new InlineKeyboard().webApp('🚀 Launch Mini App', config.webAppUrl);
  await ctx.reply('Tap below to open the RPM Mini App:', { reply_markup: kb });
});

// ─── ADMIN PANEL & APPROVAL COMMANDS ───────────────────────────────────────
bot.command('admin', async (ctx) => handleAdmin(ctx));
bot.hears('⚙️ Admin Panel', async (ctx) => handleAdmin(ctx));

async function handleAdmin(ctx: any) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await getProfileByTelegramId(telegramId);
  if (!profile || !profile.is_admin) {
    return ctx.reply('⛔ Access denied. Admin rights required.');
  }

  // Fetch pending stats
  const { data: pendingDeps } = await supabase.from('deposits').select('*').eq('status', 'pending');
  const { data: pendingWiths } = await supabase.from('withdrawals').select('*').eq('status', 'pending');
  const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

  const msg =
    `⚙️ *RPM Admin Control Panel*\n` +
    `───────────────\n` +
    `👥 *Total Registered Users:* ${userCount || 0}\n` +
    `📥 *Pending Deposits:* ${pendingDeps?.length || 0}\n` +
    `📤 *Pending Withdrawals:* ${pendingWiths?.length || 0}\n\n` +
    `Choose an action below to manage platform operations:`;

  const kb = new InlineKeyboard()
    .text(`📥 Review Deposits (${pendingDeps?.length || 0})`, 'admin_review_deposits')
    .row()
    .text(`📤 Review Withdrawals (${pendingWiths?.length || 0})`, 'admin_review_withdrawals')
    .row()
    .webApp('🌐 Full Admin Dashboard', `${config.webAppUrl}/admin`);

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
}

// ─── INLINE KEYBOARD CALLBACK ACTIONS ──────────────────────────────────────
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  // Handle plan purchase
  if (data.startsWith('buy_prod_')) {
    const productId = data.replace('buy_prod_', '');
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile) {
      await ctx.answerCallbackQuery('Please link your account first via /start');
      return;
    }

    await ctx.answerCallbackQuery('Processing investment...');
    const result = await createInvestmentOrder(profile.id, productId);
    await ctx.reply(result.message);
    return;
  }

  // Admin Review Pending Deposits
  if (data === 'admin_review_deposits') {
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const { data: deposits } = await supabase
      .from('deposits')
      .select('*, profile:user_id(name, email)')
      .eq('status', 'pending')
      .limit(5);

    if (!deposits || deposits.length === 0) {
      await ctx.answerCallbackQuery('No pending deposits!');
      return ctx.reply('✅ No pending deposits at this time.');
    }

    await ctx.answerCallbackQuery();
    for (const dep of deposits) {
      const depMsg =
        `📥 *Pending Deposit Request*\n` +
        `👤 User: *${dep.profile?.name || 'Unknown'}* (${dep.profile?.email})\n` +
        `💰 Amount: *$${dep.amount.toLocaleString()}*\n` +
        `💳 Method: ${dep.payment_method}\n` +
        `🔗 Tx Hash: \`${dep.tx_hash || 'N/A'}\` \n` +
        `📅 Date: ${new Date(dep.created_at).toLocaleString()}`;

      const kb = new InlineKeyboard()
        .text('✅ Approve Deposit', `approve_dep_${dep.id}`)
        .text('❌ Reject', `reject_dep_${dep.id}`);

      await ctx.reply(depMsg, { parse_mode: 'Markdown', reply_markup: kb });
    }
    return;
  }

  // Admin Approve Deposit Action
  if (data.startsWith('approve_dep_')) {
    const depositId = data.replace('approve_dep_', '');
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const res = await approveDeposit(depositId, profile.id);
    if (res.success) {
      await ctx.answerCallbackQuery('Deposit Approved!');
      await ctx.editMessageText(`✅ *DEPOSIT APPROVED*\nAmount: $${res.amount} credited to user wallet.`, { parse_mode: 'Markdown' });
    } else {
      await ctx.answerCallbackQuery(res.message || 'Approval failed');
    }
    return;
  }

  // Admin Reject Deposit Action
  if (data.startsWith('reject_dep_')) {
    const depositId = data.replace('reject_dep_', '');
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const res = await rejectDeposit(depositId);
    if (res.success) {
      await ctx.answerCallbackQuery('Deposit Rejected.');
      await ctx.editMessageText(`❌ *DEPOSIT REJECTED*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  // Admin Review Pending Withdrawals
  if (data === 'admin_review_withdrawals') {
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('*, profile:user_id(name, email)')
      .eq('status', 'pending')
      .limit(5);

    if (!withdrawals || withdrawals.length === 0) {
      await ctx.answerCallbackQuery('No pending withdrawals!');
      return ctx.reply('✅ No pending withdrawals at this time.');
    }

    await ctx.answerCallbackQuery();
    for (const w of withdrawals) {
      const wMsg =
        `📤 *Pending Withdrawal Request*\n` +
        `👤 User: *${w.profile?.name || 'Unknown'}* (${w.profile?.email})\n` +
        `💰 Amount: *$${w.amount.toLocaleString()}*\n` +
        `💳 Method: ${w.payment_method}\n` +
        `📍 Address: \`${w.wallet_address}\` \n` +
        `📅 Date: ${new Date(w.created_at).toLocaleString()}`;

      const kb = new InlineKeyboard()
        .text('✅ Approve Payout', `approve_with_${w.id}`)
        .text('❌ Reject & Refund', `reject_with_${w.id}`);

      await ctx.reply(wMsg, { parse_mode: 'Markdown', reply_markup: kb });
    }
    return;
  }

  // Admin Approve Withdrawal Action
  if (data.startsWith('approve_with_')) {
    const withId = data.replace('approve_with_', '');
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const res = await approveWithdrawal(withId);
    if (res.success) {
      await ctx.answerCallbackQuery('Withdrawal Approved!');
      await ctx.editMessageText(`✅ *WITHDRAWAL APPROVED*\n$${res.amount} sent to destination address.`, { parse_mode: 'Markdown' });
    }
    return;
  }

  // Admin Reject Withdrawal Action
  if (data.startsWith('reject_with_')) {
    const withId = data.replace('reject_with_', '');
    const profile = await getProfileByTelegramId(telegramId);
    if (!profile?.is_admin) return ctx.answerCallbackQuery('Admin required.');

    const res = await rejectWithdrawal(withId);
    if (res.success) {
      await ctx.answerCallbackQuery('Withdrawal Rejected & Refunded.');
      await ctx.editMessageText(`❌ *WITHDRAWAL REJECTED*\nFunds refunded back to user wallet.`, { parse_mode: 'Markdown' });
    }
    return;
  }

  // Quick Deposit Button Handler
  if (data === 'action_deposit') {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📥 *Deposit Funds*\n\n` +
      `To deposit crypto funds into your wallet, launch the Mini App or reply with your payment proof:\n\n` +
      `💳 *Official Payment Wallets:*\n` +
      `• *USDT (TRC20):* \`TXYZ1234567890RPMFidelityProAddr\`\n` +
      `• *Bitcoin (BTC):* \`1BTCAddrFidelityProRPM987654321\`\n\n` +
      `After transferring, tap *Submit Payment Receipt* inside the Mini App:`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp('📥 Submit Deposit via Mini App', `${config.webAppUrl}/app/wallet`),
      }
    );
    return;
  }

  // Quick Withdraw Button Handler
  if (data === 'action_withdraw') {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📤 *Withdraw Funds*\n\n` +
      `Enter your destination wallet address and request payout directly inside the Mini App:`,
      {
        reply_markup: new InlineKeyboard().webApp('📤 Request Withdrawal', `${config.webAppUrl}/app/wallet`),
      }
    );
    return;
  }

  if (data === 'nav_invest') return handleInvest(ctx);
  if (data === 'nav_staking') return handleStaking(ctx);
  if (data === 'nav_properties') return handleProperties(ctx);
  if (data === 'nav_dashboard') return handleDashboard(ctx);
});

// ─── TEXT INPUT LISTENER (Email linking & prompts) ───────────────────────
bot.on('message:text', async (ctx) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const text = ctx.message.text.trim();
  if (!telegramId) return;

  const state = userStates.get(telegramId);

  if (state?.action === 'awaiting_email' || (text.includes('@') && text.includes('.'))) {
    const res = await linkTelegramId(text, telegramId, username);

    if (res.success && res.profile) {
      userStates.delete(telegramId);
      const isAdmin = res.profile.is_admin;
      await ctx.reply(
        `🎉 *Account Linked Successfully!*\n\n` +
        `Welcome, *${res.profile.name}*!\n` +
        `Your Telegram account is now connected to \`${res.profile.email}\`.\n\n` +
        `💰 *Wallet Balance:* $${(res.profile.wallet_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        { parse_mode: 'Markdown', reply_markup: getMainKeyboard(isAdmin) }
      );
    } else {
      await ctx.reply(`❌ ${res.message}`);
    }
  }
});

// Start bot execution
console.log('🤖 Starting RPM / FidelityPro Telegram Bot Engine...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot is online and running as @${botInfo.username}`);
  },
});
