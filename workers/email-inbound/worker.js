// workers/email-inbound/worker.js
// Cloudflare Inbound Email Routing Worker for RPM (@remaprofitmachine.com)
// Automatically catches incoming emails sent to *@remaprofitmachine.com and forwards them to the RPM Inbound Webhook

export default {
  async email(message, env, _ctx) {
    try {
      const toAddress = message.to.toLowerCase();
      let fromAddress = message.from;
      let fromName = '';

      const fromHeader = message.headers.get('from') || '';
      if (fromHeader) {
        const fromMatch = fromHeader.match(/(?:["']?([^"'<\r\n]+)["']?\s*)?<([^>\r\n]+)>/i);
        if (fromMatch) {
          fromName = (fromMatch[1] || '').trim();
          fromAddress = (fromMatch[2] || fromAddress).trim();
        } else {
          fromAddress = fromHeader.trim();
        }
      }

      const subject = message.headers.get('subject') || '(No Subject)';
      const messageId = message.headers.get('message-id') || null;
      const inReplyTo = message.headers.get('in-reply-to') || null;

      // Extract raw MIME body
      const rawBody = await new Response(message.raw).text();

      // Dispatch to RPM Inbound Endpoint
      const appUrl = env?.RPM_APP_URL || 'https://remaprofitmachine.com';
      const webhookSecret = env?.EMAIL_INGEST_SECRET || '';

      const payload = {
        to: toAddress,
        from: fromAddress,
        fromName: fromName,
        subject: subject,
        messageId: messageId,
        inReplyTo: inReplyTo,
        rawBody: rawBody,
      };

      const response = await fetch(`${appUrl}/api/inbound-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-email-secret': webhookSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Failed to forward inbound email to RPM:', await response.text());
      } else {
        const resJson = await response.json().catch(() => ({}));
        console.log('[RPM Inbound Email] Successfully ingested:', JSON.stringify(resJson));
      }
    } catch (err) {
      console.error('Error processing inbound email in Cloudflare Worker:', err);
    }
  },
};
