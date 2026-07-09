import { supabase } from './supabaseClient';
import { toast } from 'sonner';

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  link?: string;
}

let cachedLockedSettings: Record<string, boolean> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes in milliseconds

/**
 * Checks if a specific notification type (email or push) is enabled for a user.
 * It first checks if the preference is locked (forced ON) by the admin.
 * If not locked, it falls back to the user's saved preferences.
 */
export async function isNotificationEnabled(
  userId: string,
  prefKey: 'email_info' | 'email_warning' | 'email_success' | 'email_alert' | 'push_info' | 'push_warning' | 'push_success' | 'push_alert'
): Promise<boolean> {
  try {
    const now = Date.now();
    let lockedConfig = cachedLockedSettings;

    // 1. Fetch locked config (if cache expired) and user preference in parallel
    const lockPromise = (!lockedConfig || (now - cacheTimestamp > CACHE_TTL))
      ? supabase.from('settings').select('value').eq('key', 'locked_notifications').maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [lockRes, prefRes] = await Promise.all([
      lockPromise,
      supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
    ]);

    // Update cache if we fetched new locked settings
    if (lockRes?.data?.value) {
      try {
        lockedConfig = JSON.parse(lockRes.data.value);
        cachedLockedSettings = lockedConfig;
        cacheTimestamp = now;
      } catch (e) {
        console.error('[notify] Failed to parse locked_notifications setting:', e);
      }
    }

    // 2. If locked by admin, it is forced ON (true)
    if (lockedConfig && lockedConfig[prefKey] === true) {
      return true;
    }

    // 3. Otherwise, check user preference
    if (prefRes?.data) {
      return prefRes.data[prefKey] !== false;
    }
    
    // Default to true if no preference row exists
    return true;
  } catch (e) {
    console.error('[notify] Error in isNotificationEnabled:', e);
    return true; // Safe fallback
  }
}

/**
 * Simple client-side rate limiter for outbound notification triggers.
 * Limit: 5 dispatches per 60 seconds per client browser.
 */
function checkRateLimit(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true; // SSR or server context: bypass
  }
  try {
    const key = 'notification_rate_limit_timestamps';
    const now = Date.now();
    const windowMs = 60000;
    const limit = 5;

    const raw = localStorage.getItem(key);
    let timestamps: number[] = raw ? JSON.parse(raw) : [];

    timestamps = timestamps.filter(t => (now - t) < windowMs);

    if (timestamps.length >= limit) {
      console.warn(`[notify] Rate limit reached.`);
      return false;
    }

    timestamps.push(now);
    localStorage.setItem(key, JSON.stringify(timestamps));
    return true;
  } catch (e) {
    return true; // Fail-safe
  }
}

/**
 * Sends a notification: inserts the in-app notification in Supabase
 * and invokes the send-push edge function to dispatch web push.
 */
export async function notifyUser(params: NotifyParams): Promise<void> {
  if (!checkRateLimit()) {
    toast.error('Notification rate limit reached. Please wait a moment.');
    return;
  }
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

  // 2. Call send-push edge function (respecting push preferences & admin locks)
  try {
    const key = `push_${type}` as const;
    const pushEnabled = await isNotificationEnabled(userId, key);
    
    if (pushEnabled) {
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
    }
  } catch (e) {
    console.warn('[notify] Push notification invoke failed (non-fatal):', e);
  }
}

/** Sends an email to a user, respecting their notification preferences & admin locks */
export async function sendEmailToUser(
  userId: string,
  type: 'info' | 'warning' | 'success' | 'alert',
  subject: string,
  htmlContent: string
): Promise<boolean> {
  if (!checkRateLimit()) {
    toast.error('Email rate limit reached. Please wait a moment.');
    return false;
  }
  try {
    // 1. Get user profile and email
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (profErr || !profile?.email) return false;

    // 2. Check notification preferences (respecting admin locks)
    const key = `email_${type}` as const;
    const emailEnabled = await isNotificationEnabled(userId, key);
    
    if (!emailEnabled) {
      console.log(`[notify] Email notification for type ${type} is disabled by user ${userId}`);
      return false;
    }

    // 3. Send email
    await sendEmailAndLog(profile.email, subject, htmlContent);
    return true;
  } catch (err) {
    console.error('[notify] sendEmailToUser failed:', err);
    return false;
  }
}

/** Sends a notification to multiple users */
export async function notifyUsers(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
  await Promise.all(userIds.map(userId => notifyUser({ ...params, userId })));
}

/** Sends an in-app and web-push notification to all admin profiles */
export async function notifyAdmins(params: Omit<NotifyParams, 'userId'>): Promise<void> {
  const { title, message, type, link } = params;
  try {
    // 1. Fetch all admins
    const { data: admins, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
      
    if (fetchError) throw fetchError;
    if (!admins || admins.length === 0) return;

    const adminIds = admins.map(a => a.id);

    // 2. Write in-app notifications
    const inserts = adminIds.map(adminId => ({
      user_id: adminId,
      title,
      message,
      type,
      link: link || null,
      read: false,
      created_at: new Date().toISOString(),
    }));
    
    const { error: insertError } = await supabase.from('notifications').insert(inserts);
    if (insertError) throw insertError;

    // 3. Dispatch web push
    await supabase.functions.invoke('send-push', {
      body: {
        user_ids: adminIds,
        title,
        body: message,
        url: link || '/admin',
        tag: type,
        notification_type: type,
      },
    });
  } catch (e) {
    console.error('[notifyAdmins] failed:', e);
  }
}

/** Sends an email notification to all admin profiles */
export async function notifyAdminsWithEmail(subject: string, htmlContent: string): Promise<void> {
  try {
    // 1. Fetch all admin emails
    const { data: admins, error: fetchError } = await supabase
      .from('profiles')
      .select('email')
      .eq('is_admin', true);

    if (fetchError) throw fetchError;
    if (!admins) return;

    const adminEmails = admins.map(a => a.email).filter(Boolean);

    // 2. Invoke send-email for each admin
    await Promise.all(adminEmails.map(async (email) => {
      try {
        await sendEmailAndLog(email, subject, htmlContent);
      } catch (err) {
        console.warn(`[notifyAdminsWithEmail] Failed to send email to ${email}:`, err);
      }
    }));
  } catch (e) {
    console.error('[notifyAdminsWithEmail] failed:', e);
  }
}

/** Logs and sends an email via Deno Edge function */
export async function sendEmailAndLog(to: string, subject: string, htmlContent: string): Promise<any> {
  try {
    // 1. Invoke send-email Edge function
    const res = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html: htmlContent,
      },
    });

    // 2. Log details to email_logs database table
    const { error } = await supabase.from('email_logs').insert({
      recipient: to,
      subject,
      body: htmlContent
    });
    if (error) {
      console.warn('[sendEmailAndLog] Failed to insert log to database:', error);
    }
    
    return res;
  } catch (err) {
    console.error('[sendEmailAndLog] Failed:', err);
    throw err;
  }
}

