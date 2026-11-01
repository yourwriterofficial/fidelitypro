/**
 * Official RPM Site Email Template Engine
 * Generates responsive, production-grade HTML email templates for all outbound communications,
 * legal dispatches, account statements, and support correspondence.
 */

export interface RpmEmailTemplateOptions {
  recipientName?: string;
  subject: string;
  content: string; // HTML or multi-line plain text
  mailboxAddress?: string;
  mailboxDisplayName?: string;
  actionButton?: {
    text: string;
    url: string;
  };
  trackingRef?: string;
  departmentTag?: string;
}

export function wrapInRpmSiteTemplate(options: RpmEmailTemplateOptions): string {
  const {
    recipientName = 'Valued Client',
    subject,
    content,
    mailboxAddress = 'support@remaprofitmachine.com',
    mailboxDisplayName = 'RPM General Support Desk',
    actionButton,
    trackingRef = `RPM-MSG-${Date.now().toString(36).toUpperCase()}`,
    departmentTag = 'Institutional Support Desk',
  } = options;

  // Convert plain text newlines into HTML paragraphs if not already rich HTML
  const isRichHtml = /<(?:p|div|table|h[1-6]|ul|ol)[^>]*>/i.test(content);
  const formattedBody = isRichHtml
    ? content
    : content
        .split(/\n{2,}/)
        .map((p) => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #1e293b;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

  const siteUrl = 'https://remaprofitmachine.com';

  const actionButtonHtml = actionButton
    ? `
      <div style="text-align: center; margin: 32px 0 24px 0;">
        <a href="${actionButton.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #00674F; color: #ffffff; padding: 14px 28px; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none; letter-spacing: 0.2px; box-shadow: 0 4px 10px rgba(0, 103, 79, 0.25);">
          ${actionButton.text} &rarr;
        </a>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <!-- Email Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; border-bottom: 3px solid #00674F;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                      <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background-color: #00674F; color: #ffffff; font-weight: 900; font-size: 15px; border-radius: 7px; margin-right: 8px;">R</span>
                      <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; vertical-align: middle;">RPM</span>
                    </div>
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-top: 4px;">
                      Rema Profit Machine &amp; Portfolio Platform
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(0, 103, 79, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${escapeHtml(departmentTag)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Subject Title Bar -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 32px; border-bottom: 1px solid #e2e8f0;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
                Official Correspondence
              </div>
              <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.35;">
                ${escapeHtml(subject)}
              </h1>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; font-size: 15px; line-height: 1.65; color: #1e293b;">
              <div style="margin-bottom: 20px; font-size: 15px; font-weight: 600; color: #0f172a;">
                Dear ${escapeHtml(recipientName)},
              </div>

              <div style="color: #334155; font-size: 15px; line-height: 1.65;">
                ${formattedBody}
              </div>

              ${actionButtonHtml}

              <!-- Sign-off block -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 14px; color: #475569;">
                <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">Respectfully,</p>
                <p style="margin: 0 0 2px 0; font-weight: 600; color: #00674F;">${escapeHtml(mailboxDisplayName)}</p>
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  <a href="mailto:${escapeHtml(mailboxAddress)}" style="color: #00674F; text-decoration: none;">${escapeHtml(mailboxAddress)}</a> &middot; <a href="${siteUrl}" style="color: #64748b; text-decoration: none;">${siteUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Security & Audit Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.55;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                      <span style="color: #00674F;">&#9632;</span> Secure Client Dispatch &middot; ${escapeHtml(trackingRef)}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                      This message was transmitted from an authenticated RPM institutional mailbox. If you did not expect this correspondence or believe you received it in error, please forward it immediately to <a href="mailto:security@remaprofitmachine.com" style="color: #00674F; text-decoration: underline;">security@remaprofitmachine.com</a>.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
                    &copy; 2026 RPM (Rema Profit Machine). All rights reserved. &middot; Private &amp; Confidential
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
