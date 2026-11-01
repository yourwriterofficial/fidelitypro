export const config = {
  runtime: 'edge',
};

// Authorized admin and test email addresses
const AUTHORIZED_TEST_RECIPIENTS = [
  'pennysubsofficial@gmail.com',
  'prop_test_2026@rpmapp.internal',
];

function sanitizeRecipient(recipient: string): { finalRecipient: string; redirected: boolean; original: string } {
  const lower = recipient.toLowerCase().trim();
  const isAllowed =
    AUTHORIZED_TEST_RECIPIENTS.includes(lower) ||
    lower.endsWith('@rpmapp.internal') ||
    lower.includes('testmail.io') ||
    lower.includes('+test@');

  if (isAllowed) {
    return { finalRecipient: recipient, redirected: false, original: recipient };
  }

  // Safety protection: redirect to owner/admin email only
  return {
    finalRecipient: 'pennysubsofficial@gmail.com',
    redirected: true,
    original: recipient,
  };
}

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

    // Safety firewall: check recipient and re-route to admin if not test/admin
    const rawRecipient = Array.isArray(to) ? to[0] : to;
    const { finalRecipient, redirected, original } = sanitizeRecipient(rawRecipient);

    const effectiveSubject = redirected
      ? `[Admin Forward · Intended for: ${original}] ${subject}`
      : subject;

    const safetyBanner = redirected
      ? `<div style="padding: 10px 14px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; font-size: 12px; margin-bottom: 16px; color: #92400e; font-family: sans-serif;">
           <strong>🔒 SAFETY GUARD ACTIVE:</strong> This email was originally targeted to <strong>${original}</strong>. Pursuant to security rules, actual user dispatches are barred and forwarded exclusively to the owner/admin inbox (<code>${finalRecipient}</code>).
         </div>`
      : '';

    const effectiveHtml = `${safetyBanner}${html}`;

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
      console.warn(`[Dev Simulation] To: ${finalRecipient} (originally ${original}) | Subject: ${effectiveSubject}`);
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
            // Fallback to Resend onboarding sender for sandbox delivery to admin
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

    // Log to Supabase email_logs
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
            recipient: `${finalRecipient} (intended: ${original})`,
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
        redirected,
        intendedFor: original,
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
