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

  // 2. Call send-push edge function (respecting push preferences)
  try {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    const key = `push_${type}` as const;
    const pushEnabled = prefs ? prefs[key] !== false : true;
    
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

/** Sends an email to a user, respecting their notification preferences */
export async function sendEmailToUser(
  userId: string,
  type: 'info' | 'warning' | 'success' | 'alert',
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    // 1. Get user profile and email
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (profErr || !profile?.email) return false;

    // 2. Get notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    const key = `email_${type}` as const;
    const emailEnabled = prefs ? prefs[key] !== false : true;
    
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

