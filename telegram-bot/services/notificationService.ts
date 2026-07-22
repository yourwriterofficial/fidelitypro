import { bot } from '../bot.js';
import { supabase } from './supabase.js';

export function startNotificationService() {
  console.log('🔔 Initializing Real-Time Telegram Notification Listener...');

  // Subscribe to Supabase notifications table insertions
  supabase
    .channel('public:notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      async (payload) => {
        const notif = payload.new;
        if (!notif || !notif.user_id) return;

        // Fetch user's telegram_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_id, name')
          .eq('id', notif.user_id)
          .single();

        if (profile && profile.telegram_id) {
          try {
            const notifMsg =
              `🔔 *${notif.title || 'Platform Notification'}*\n\n` +
              `${notif.message}\n\n` +
              `_Timestamp: ${new Date(notif.created_at || Date.now()).toLocaleString()}_`;

            await bot.api.sendMessage(profile.telegram_id, notifMsg, {
              parse_mode: 'Markdown',
            });
            console.log(`✅ Telegram alert sent to user ${profile.name} (ID: ${profile.telegram_id})`);
          } catch (err) {
            console.error(`Failed to send Telegram message to ${profile.telegram_id}:`, err);
          }
        }
      }
    )
    .subscribe();
}
