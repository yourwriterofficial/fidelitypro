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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const resendKey = (
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    ''
  ).trim();

  if (!resendKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured', emails: [] }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    const listRes = await fetch('https://api.resend.com/emails/receiving', {
      headers: { Authorization: `Bearer ${resendKey}` },
    });

    if (!listRes.ok) {
      const errData = await listRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: false,
          error: (errData as any).message || `HTTP ${listRes.status}`,
          emails: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const listData = (await listRes.json()) as any;
    const items = listData?.data || [];
    const emails: any[] = [];

    // Fetch full body (text/html) for the most recent inbound emails
    for (const item of items.slice(0, 20)) {
      try {
        const detailRes = await fetch(`https://api.resend.com/emails/receiving/${item.id}`, {
          headers: { Authorization: `Bearer ${resendKey}` },
        });

        if (detailRes.ok) {
          const detail = (await detailRes.json()) as any;
          emails.push({
            id: item.id,
            from: detail.from || item.from,
            to: detail.to || item.to,
            subject: detail.subject || item.subject,
            text: detail.text || '',
            html: detail.html || '',
            created_at: detail.created_at || item.created_at,
            message_id: detail.message_id || item.message_id,
            attachments: detail.attachments || item.attachments || [],
          });
        } else {
          emails.push(item);
        }
      } catch {
        emails.push(item);
      }
    }

    return new Response(JSON.stringify({ success: true, emails }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, emails: [] }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
