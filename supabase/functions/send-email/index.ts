import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_URL = 'https://api.resend.com/emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    let via = 'resend';
    let success = false;

    try {
      if (!RESEND_API_KEY) {
        throw new Error('Resend API key is missing');
      }

      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || 'FidelityPro <noreply@fidelitypro.org>',
          to,
          subject,
          html,
        }),
      });

      data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Resend API error');
      }
      success = true;
    } catch (resendError: any) {
      console.warn('Resend failed:', resendError.message);
      
      const APPS_SCRIPT_URL = Deno.env.get('GOOGLE_APPS_SCRIPT_URL') || '';
      if (APPS_SCRIPT_URL) {
        console.log('Attempting fallback to Google Apps Script...');
        const fallbackRes = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html }),
        });

        if (fallbackRes.ok) {
          success = true;
          via = 'google_apps_script';
          data = { message: 'Sent via Google Apps Script' };
        } else {
          const fallbackText = await fallbackRes.text();
          throw new Error(`Both Resend and Apps Script fallback failed. Apps Script error: ${fallbackText}`, { cause: resendError });
        }
      } else {
        throw resendError;
      }
    }

    return new Response(
      JSON.stringify({ success, via, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
