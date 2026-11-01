export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // CORS & preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { to, subject, html, text, from, replyTo, attachments } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: to, subject, and html are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Direct recipient dispatch — deliver strictly to the actual user
    const rawRecipient = Array.isArray(to) ? to[0] : to;
    const finalRecipient = (rawRecipient || '').trim();

    if (!finalRecipient || !finalRecipient.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid destination email address provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const effectiveSubject = subject;
    const effectiveHtml = html;

    const resendKey = (
      process.env.RESEND_API_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      ''
    ).trim();

    const fromAddress = from || 'RPM Support <support@remaprofitmachine.com>';
    const replyToAddress = replyTo || 'support@remaprofitmachine.com';

    let deliveryStatus = 'sent';
    let providerId: string | null = null;
    let providerError: string | null = null;

    if (!resendKey) {
      deliveryStatus = 'dev_logged';
      providerError = 'RESEND_API_KEY not configured on server (simulation mode)';
      console.warn(`[Dev Simulation] To: ${finalRecipient} | Subject: ${effectiveSubject}`);
    } else {
      try {
        const payload: Record<string, any> = {
          from: fromAddress,
          to: [finalRecipient],
          reply_to: replyToAddress,
          subject: effectiveSubject,
          html: effectiveHtml,
          text: text || effectiveSubject,
        };

        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          payload.attachments = attachments;
        }

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        let resendData = (await resendRes.json()) as any;

        if (!resendRes.ok) {
          const errMsg = (resendData.message || resendData.error || '').toLowerCase();
          if (errMsg.includes('domain') || errMsg.includes('not verified') || errMsg.includes('validation_error')) {
            // Fallback sender for deliverability
            try {
              const fallbackPayload = {
                ...payload,
                from: 'RPM Support <onboarding@resend.dev>',
              };
              const fallbackRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fallbackPayload),
              });
              const fallbackData = (await fallbackRes.json()) as any;
              if (fallbackRes.ok) {
                deliveryStatus = 'sent';
                providerId = fallbackData.id || null;
                providerError = null;
              } else {
                deliveryStatus = 'failed';
                providerError = fallbackData.message || fallbackData.error || `HTTP ${fallbackRes.status}`;
              }
            } catch (fallbackErr: any) {
              deliveryStatus = 'failed';
              providerError = fallbackErr.message;
            }
          } else {
            deliveryStatus = 'failed';
            providerError = resendData.message || resendData.error || `HTTP ${resendRes.status}`;
            console.error('[Resend Error]', providerError);
          }
        } else {
          providerId = resendData.id || null;
        }
      } catch (err: any) {
        deliveryStatus = 'failed';
        providerError = err.message || 'Network error reaching Resend';
      }
    }

    // Log audit to Supabase email_logs
    try {
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
            recipient: finalRecipient,
            subject: effectiveSubject,
            body: effectiveHtml.slice(0, 4000),
          }),
        }).catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    return new Response(
      JSON.stringify({
        success: deliveryStatus === 'sent' || deliveryStatus === 'dev_logged',
        status: deliveryStatus,
        providerId,
        error: providerError,
        deliveredTo: finalRecipient,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error in email service' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
