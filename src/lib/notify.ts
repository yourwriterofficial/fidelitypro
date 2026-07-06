import { supabase } from './supabaseClient';

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  link?: string;
}

/**
 * Sends a notification: inserts the in-app notification in Supabase
 * and invokes the send-push edge function to dispatch web push.
 */
export async function notifyUser(params: NotifyParams): Promise<void> {
  const { userId, title, message, type, link } = params;

  // 1. Write to database notifications table
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link: link || null,
      read: false,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (e) {
    console.error('[notify] Failed to write to notifications table:', e);
  }

  // 2. Call send-push edge function
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        user_ids: [userId],
        title,
        body: message,
        url: link || '/app',
        tag: type,
        notification_type: type,
      },
    });
  } catch (e) {
    console.warn('[notify] Push notification invoke failed (non-fatal):', e);
  }
}

/** Sends a notification to multiple users */
export async function notifyUsers(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
  await Promise.all(userIds.map(userId => notifyUser({ ...params, userId })));
}
