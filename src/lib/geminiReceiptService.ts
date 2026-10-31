import { supabase } from './supabaseClient';

export interface PayoutReceiptData {
  lawFirmName: string;
  lawFirmSubtitle: string;
  lawyerName: string;
  lawyerTitle: string;
  lawFirmAddress: string;
  lawFirmPhone: string;
  lawFirmEmail: string;
  receiptNo: string;
  dateOfIssue: string;
  recipientName: string;
  recipientRef: string;
  subject: string;
  salutation: string;
  bodyParagraphs: string[];
  schedulePayee: string;
  scheduleAccountRef: string;
  grossAmount: string;
  netDisbursed: string;
  effectiveDate: string;
  transactionRef: string;
  deliveryStatus: string;
  closingNote: string;
  signoff: string;
  signatoryName: string;
  signatoryTitle: string;
  confidentialityNotice: string;
}

/** Default legal template prefilled for Wayne Bobo / Dean McMahon */
export function getDefaultReceiptData(userName?: string, userRef?: string, amount?: number): PayoutReceiptData {
  const name = userName || 'Wayne Bobo';
  const ref = userRef || `RPM-ACC-${name.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'WBOBO'}-2026`;
  const amtFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 78958.00);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    lawFirmName: 'McMahon & Associates',
    lawFirmSubtitle: 'Attorneys at Law · Trust & Escrow Conveyancing',
    lawyerName: 'Dean McMahon, Esq.',
    lawyerTitle: 'Independent Disbursement Counsel',
    lawFirmAddress: '88 Wall Street, Suite 600, New York, NY 10005',
    lawFirmPhone: '+1 (212) 555-0344',
    lawFirmEmail: 'dmcmahon@mcmahonlaw.io',
    receiptNo: `RPM-RECV-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    dateOfIssue: today,
    recipientName: name,
    recipientRef: ref,
    subject: 'Release of Settlement Funds — Confirmed Receipt Following Submission of RPM Account Statement',
    salutation: `Dear Mr. ${name.split(' ').pop() || name},`,
    bodyParagraphs: [
      'I write in my capacity as your independent disbursement counsel to formally confirm and document the successful completion of the fund release process in respect of the above-referenced escrow settlement.',
      'As you will recall, this office issued a prior legal instruction requiring you, as a condition precedent to disbursement, to obtain and submit a certified and verified Account Statement from RPM Global Investment Platform bearing your account reference and certified standing. You have fully complied with that instruction.',
      `Upon receipt of the said certified RPM Account Statement and following our internal fiduciary review procedures, this office has successfully released and disbursed the held funds in their entirety. The gross settlement proceeds of ${amtFormatted} USD have been confirmed as delivered to you in full. There are no further outstanding conditions, holds, or requirements associated with this matter.`,
      'This receipt constitutes conclusive evidence of completed disbursement and is issued pursuant to your presentation of the required RPM Account Statement. Please retain this document for your permanent financial records.'
    ],
    schedulePayee: name,
    scheduleAccountRef: ref,
    grossAmount: amtFormatted,
    netDisbursed: amtFormatted,
    effectiveDate: today,
    transactionRef: `RPM-TXN-${Math.floor(1000000 + Math.random() * 9000000)}-EFT`,
    deliveryStatus: '✓ SUCCESSFULLY DELIVERED',
    closingNote: 'Please retain this document alongside your certified RPM Global Account Statement as part of your permanent legal and financial archives. This receipt bears the full authority and official seal of McMahon & Associates, Attorneys at Law.',
    signoff: 'Yours faithfully,',
    signatoryName: 'Dean McMahon',
    signatoryTitle: 'Dean McMahon, Esq. · Independent Disbursement Counsel',
    confidentialityNotice: 'This communication is intended solely for the named recipient and constitutes a privileged and confidential legal document. Unauthorised review, use, disclosure, or distribution is strictly prohibited.'
  };
}

/** Get the configured Gemini API Key */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'gemini_api_key').maybeSingle();
    if (data?.value?.trim()) return data.value.trim();
  } catch (err) {
    console.warn('[Gemini] Could not fetch key from settings:', err);
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  return envKey || '';
}

/**
 * Generate receipt data using Gemini API (gemini-flash-latest / gemini-3.8-flash)
 */
export async function generateReceiptWithGemini(
  promptDescription: string,
  targetUser?: { name: string; ref?: string; balance?: number }
): Promise<PayoutReceiptData> {
  const apiKey = await getGeminiApiKey();

  // If no API key configured, use intelligent local fallback
  if (!apiKey) {
    console.warn('[Gemini] No API key found; generating with local legal engine');
    return generateReceiptLocally(promptDescription, targetUser);
  }

  const systemInstruction = `You are an elite legal drafting assistant for an independent disbursement counsel (e.g. Dean McMahon, Esq. of McMahon & Associates).
The user provides a description of an escrow payout / fund release receipt.
Generate a complete, professionally worded legal release receipt in JSON format.
Ensure that if the description mentions RPM or account statements, it emphasizes that the lawyer instructed the client to provide their statement of account from RPM, and upon submitting it, the funds were successfully released and confirmed delivered.

Return ONLY a JSON object matching this schema:
{
  "lawFirmName": string,
  "lawFirmSubtitle": string,
  "lawyerName": string,
  "lawyerTitle": string,
  "lawFirmAddress": string,
  "lawFirmPhone": string,
  "lawFirmEmail": string,
  "receiptNo": string,
  "dateOfIssue": string,
  "recipientName": string,
  "recipientRef": string,
  "subject": string,
  "salutation": string,
  "bodyParagraphs": string[],
  "schedulePayee": string,
  "scheduleAccountRef": string,
  "grossAmount": string,
  "netDisbursed": string,
  "effectiveDate": string,
  "transactionRef": string,
  "deliveryStatus": string,
  "closingNote": string,
  "signoff": string,
  "signatoryName": string,
  "signatoryTitle": string,
  "confidentialityNotice": string
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: `${systemInstruction}\n\nClient Name: ${targetUser?.name || 'Wayne Bobo'}\nClient Account Reference: ${targetUser?.ref || 'RPM-ACC-WBOBO-2026'}\n\nDescription to draft:\n${promptDescription}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Gemini] HTTP error ${res.status}:`, errText);
      return generateReceiptLocally(promptDescription, targetUser);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return generateReceiptLocally(promptDescription, targetUser);

    // Strip markdown code fences if present (```json ... ```)
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      ...getDefaultReceiptData(targetUser?.name, targetUser?.ref, targetUser?.balance),
      ...parsed,
      bodyParagraphs: Array.isArray(parsed.bodyParagraphs) ? parsed.bodyParagraphs : [parsed.bodyParagraphs || '']
    };
  } catch (err) {
    console.warn('[Gemini] AI generation failed or timed out; falling back to template:', err);
    return generateReceiptLocally(promptDescription, targetUser);
  }
}

/** Local rule-based parser as fallback */
function generateReceiptLocally(promptDescription: string, targetUser?: { name: string; ref?: string; balance?: number }): PayoutReceiptData {
  const base = getDefaultReceiptData(targetUser?.name, targetUser?.ref, targetUser?.balance);
  const text = promptDescription.toLowerCase();

  // Extract amount if mentioned (e.g. $78,958 or 78958)
  const amtMatch = promptDescription.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  if (amtMatch && amtMatch[1]) {
    const num = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      const fmtVal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      base.grossAmount = fmtVal;
      base.netDisbursed = fmtVal;
    }
  }

  // Extract recipient name if mentioned
  if (targetUser?.name) {
    base.recipientName = targetUser.name;
    base.schedulePayee = targetUser.name;
    base.salutation = `Dear Mr./Ms. ${targetUser.name.split(' ').pop()},`;
  }

  // Extract lawyer name if mentioned
  if (text.includes('mcmahon') || text.includes('dean')) {
    base.lawyerName = 'Dean McMahon, Esq.';
    base.lawFirmName = 'McMahon & Associates';
    base.signatoryName = 'Dean McMahon';
  }

  return base;
}
