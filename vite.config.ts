import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'api-dev-server-proxy',
        configureServer(server) {
          // Dev middleware for /api/send-email
          server.middlewares.use('/api/send-email', async (req, res) => {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
              res.statusCode = 204;
              return res.end();
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Method not allowed' }));
            }

            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', async () => {
              try {
                const { to, subject, html, text, from, replyTo, attachments } = JSON.parse(bodyStr || '{}');
                const resendKey = (env.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
                const fromAddress = from || 'RPM Support <support@remaprofitmachine.com>';
                const replyToAddress = replyTo || 'support@remaprofitmachine.com';

                // Safety guard: only forward to admin/test addresses
                const rawRecipient = (Array.isArray(to) ? to[0] : to || '').toLowerCase().trim();
                const isAllowed = rawRecipient === 'pennysubsofficial@gmail.com' ||
                  rawRecipient.endsWith('@rpmapp.internal') ||
                  rawRecipient.includes('testmail.io') ||
                  rawRecipient.includes('+test@');

                const finalRecipient = isAllowed ? rawRecipient : 'pennysubsofficial@gmail.com';
                const redirected = !isAllowed;
                const effectiveSubject = redirected ? `[Admin Forward · Intended for: ${rawRecipient}] ${subject}` : subject;
                const safetyBanner = redirected ? `<div style="padding: 10px 14px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; font-size: 12px; margin-bottom: 16px; color: #92400e;"><strong>🔒 SAFETY GUARD ACTIVE:</strong> Originally addressed to <strong>${rawRecipient}</strong>. Delivered strictly to admin (${finalRecipient}).</div>` : '';
                const effectiveHtml = `${safetyBanner}${html}`;

                let status = 'sent';
                let providerId = null;
                let errorMsg = null;

                if (!resendKey) {
                  status = 'dev_logged';
                  errorMsg = 'RESEND_API_KEY not set (logged in local preview mode)';
                } else {
                  try {
                    const resendRes = await fetch('https://api.resend.com/emails', {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${resendKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        from: fromAddress,
                        to: [finalRecipient],
                        reply_to: replyToAddress,
                        subject: effectiveSubject,
                        html: effectiveHtml,
                        text: text || effectiveSubject,
                        ...(attachments ? { attachments } : {}),
                      }),
                    });

                    let resendData = (await resendRes.json()) as any;
                    if (!resendRes.ok) {
                      const msg = (resendData.message || resendData.error || '').toLowerCase();
                      if (msg.includes('domain') || msg.includes('not verified') || msg.includes('validation_error')) {
                        // Fallback to Resend default sandbox sender for test delivery to owner
                        try {
                          const fallbackRes = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${resendKey}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              from: 'RPM Support <onboarding@resend.dev>',
                              to: [finalRecipient],
                              reply_to: replyToAddress,
                              subject: effectiveSubject,
                              html: effectiveHtml,
                              text: text || effectiveSubject,
                              ...(attachments ? { attachments } : {}),
                            }),
                          });
                          const fallbackData = (await fallbackRes.json()) as any;
                          if (fallbackRes.ok) {
                            status = 'sent';
                            providerId = fallbackData.id || null;
                            errorMsg = null;
                          } else {
                            status = 'failed';
                            errorMsg = fallbackData.message || fallbackData.error || `HTTP ${fallbackRes.status}`;
                          }
                        } catch (fallbackErr: any) {
                          status = 'failed';
                          errorMsg = fallbackErr.message;
                        }
                      } else {
                        status = 'failed';
                        errorMsg = resendData.message || resendData.error || `HTTP ${resendRes.status}`;
                      }
                    } else {
                      providerId = resendData.id || null;
                    }
                  } catch (e: any) {
                    status = 'failed';
                    errorMsg = e.message;
                  }
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: status === 'sent' || status === 'dev_logged',
                  status,
                  providerId,
                  error: errorMsg,
                  from: fromAddress,
                  to,
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });

          // Dev middleware for /api/generate-receipt
          server.middlewares.use('/api/generate-receipt', async (req, res) => {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
              res.statusCode = 204;
              return res.end();
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Method not allowed' }));
            }

            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', async () => {
              try {
                const { promptDescription, targetUser } = JSON.parse(bodyStr || '{}');
                const deepseekKey = (env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '').trim();

                if (!deepseekKey) {
                  res.statusCode = 503;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'No key on server', fallback: true }));
                }

                const sysPrompt = `You are a Senior Fiduciary Counsel and Legal Document Architect specializing in drafting formal commercial instruments, escrow disbursements, safekeeping receipts, regulatory clearance letters, and legal notices. Return ONLY valid JSON with keys: documentTitle, lawyerName, lawFirmName, lawFirmAddress, lawyerContact, receiptRef, dateOfIssue, recipientName, recipientAccountRef, salutation, legalBodyParagraphs (array of 3-4 strings), settlementTable (object with grossAmount, deductions, netDisbursed, deliveryRail, transactionRef, legalStatus), officialNotice, juratAttestation, barLicenseNo, confidentialityNotice.`;

                const aiRes = await fetch('https://api.deepseek.com/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${deepseekKey}`,
                  },
                  body: JSON.stringify({
                    model: 'deepseek-chat',
                    response_format: { type: 'json_object' },
                    temperature: 0.2,
                    messages: [
                      { role: 'system', content: sysPrompt },
                      { role: 'user', content: `Target beneficiary: ${targetUser?.name || 'Authorized Beneficiary'}. Account: ${targetUser?.ref || 'RPM-ACC-2026'}. Amount: ${targetUser?.amount ? '$' + Number(targetUser.amount).toLocaleString() : '$78,958.00'}. Description: ${promptDescription}` },
                    ],
                  }),
                });

                const data = (await aiRes.json()) as any;
                if (!aiRes.ok) {
                  res.statusCode = aiRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: data.error?.message || 'DeepSeek API error', fallback: true }));
                }

                const content = data.choices?.[0]?.message?.content;
                const parsed = JSON.parse(content);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, receipt: parsed }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message, fallback: true }));
              }
            });
          });

          // Dev middleware for /api/inbound-email & /api/email/inbound
          const handleInbound = async (req: any, res: any) => {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-email-secret');
              res.statusCode = 204;
              return res.end();
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Method not allowed' }));
            }

            let bodyStr = '';
            req.on('data', (chunk: any) => { bodyStr += chunk; });
            req.on('end', async () => {
              try {
                const data = JSON.parse(bodyStr || '{}');
                const from = data.from || data.sender || (data.data && data.data.from) || '';
                const to = data.to || (data.data && data.data.to) || 'support@remaprofitmachine.com';
                const subject = data.subject || (data.data && data.data.subject) || '(No Subject)';
                const text = data.text || data.rawBody || data.body || (data.data && data.data.text) || '';
                const html = data.html || (data.data && data.data.html) || '';

                // Log to Supabase email_logs
                const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
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

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Inbound email received and logged.',
                  from,
                  to,
                  subject,
                }));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: e.message }));
              }
            });
          };

          server.middlewares.use('/api/inbound-email', handleInbound);
          server.middlewares.use('/api/email/inbound', handleInbound);

          // Dev middleware to sync received emails from Resend Inbound API
          server.middlewares.use('/api/sync-inbound', async (req: any, res: any) => {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
              res.statusCode = 204;
              return res.end();
            }

            const resendKey = (env.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
            if (!resendKey) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'No RESEND_API_KEY set', emails: [] }));
            }

            try {
              const listRes = await fetch('https://api.resend.com/emails/receiving', {
                headers: { Authorization: `Bearer ${resendKey}` },
              });
              const listData = (await listRes.json()) as any;
              const items = listData?.data || [];
              const emails: any[] = [];

              for (const item of items.slice(0, 15)) {
                try {
                  const detailRes = await fetch(`https://api.resend.com/emails/receiving/${item.id}`, {
                    headers: { Authorization: `Bearer ${resendKey}` },
                  });
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
                  });
                } catch {
                  emails.push(item);
                }
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, emails }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message, emails: [] }));
            }
          });
        },
      },
    ],
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/')) {
                return 'vendor-react';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-tanstack';
              }
              if (id.includes('lucide-react') || id.includes('sonner') || id.includes('zustand')) {
                return 'vendor-ui';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
