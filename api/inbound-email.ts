export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-email-secret',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const raw = await req.json().catch(() => ({}));

    // Resend webhook wrapper structure: { type: 'email.received', data: { email_id, from, to, subject, ... } }
    const emailMeta = raw.data || raw;
    let from = emailMeta.from || raw.sender || '';
    let to = Array.isArray(emailMeta.to) ? emailMeta.to[0] : (emailMeta.to || 'support@remaprofitmachine.com');
    let subject = emailMeta.subject || '(No Subject)';
    let text = emailMeta.text || raw.rawBody || raw.body || '';
    let html = emailMeta.html || '';

    const emailId = emailMeta.email_id || emailMeta.id || raw.email_id;

    // If Resend transmitted webhook metadata without body, fetch full email from Resend API
    const resendKey = (
      process.env.RESEND_API_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      ''
    ).trim();

    if (emailId && resendKey && (!text || !html)) {
      try {
        const detailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as any;
          if (detail.from) from = detail.from;
          if (detail.to) to = Array.isArray(detail.to) ? detail.to[0] : detail.to;
          if (detail.subject) subject = detail.subject;
          if (detail.text) text = detail.text;
          if (detail.html) html = detail.html;
        }
      } catch (fetchErr) {
        console.warn('[Inbound Webhook] Could not fetch detail from Resend:', fetchErr);
      }
    }

    // Record in email_logs if Supabase credentials available
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          recipient: `Support Inbox (From: ${from})`,
          subject: `[INBOUND] ${subject}`,
          body: (html || text || '').slice(0, 4000),
        }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Inbound email successfully ingested',
        emailId,
        from,
        to,
        subject,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
