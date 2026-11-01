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
    const data = await req.json();

    const from = data.from || data.sender || (data.data && data.data.from) || '';
    const to = data.to || (data.data && data.data.to) || 'support@remaprofitmachine.com';
    const subject = data.subject || (data.data && data.data.subject) || '(No Subject)';
    const text = data.text || data.rawBody || data.body || (data.data && data.data.text) || '';
    const html = data.html || (data.data && data.data.html) || '';

    // Record in email_logs
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
          body: (html || text).slice(0, 4000),
        }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Inbound email successfully ingested',
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
