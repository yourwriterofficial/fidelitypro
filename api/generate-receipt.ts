export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // CORS & method verification
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
    const { promptDescription, targetUser, apiKey: clientProvidedKey } = await req.json();

    if (!promptDescription || typeof promptDescription !== 'string') {
      return new Response(JSON.stringify({ error: 'promptDescription is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve DeepSeek key: server environment variable or client-stored token
    const deepseekKey = (
      process.env.DEEPSEEK_API_KEY ||
      process.env.VITE_DEEPSEEK_API_KEY ||
      clientProvidedKey ||
      ''
    ).trim();

    if (!deepseekKey) {
      return new Response(
        JSON.stringify({
          error: 'No AI key configured on server. Provide apiKey or configure DEEPSEEK_API_KEY.',
          fallback: true,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = `You are an elite legal conveyancing, fiduciary, and corporate escrow drafting counsel.
The user provides instructions to draft a formal legal instrument, letterhead document, escrow receipt, or regulatory directive.

Analyze the user's instructions and tone with supreme intelligence:
1. CONDITIONAL HOLDS & STATEMENT REQUISITIONS (e.g. Wayne needs to collect and provide his account statement before he is paid, or funds held pending AML/KYC):
   - Draft a formal "CONDITIONAL ESCROW HOLD & MANDATORY REQUISITION FOR CERTIFIED ACCOUNT STATEMENT".
   - State clearly that funds ($X) are in secure escrow, but payment release is legally conditioned upon the beneficiary collecting and providing their certified Statement of Account.
   - Set deliveryStatus to: "⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING".
   - Make bodyParagraphs explain why the certified statement is required, what conditions must be satisfied, and how funds will disburse within 24 hours of statement validation.
2. CONFIRMED DISBURSEMENTS & PAYOUT RECEIPTS (e.g. funds released, statement verified, escrow cleared):
   - Draft a formal "OFFICIAL RECEIPT AND IRREVOCABLE RELEASE OF SETTLEMENT DISBURSEMENT".
   - Set deliveryStatus to: "✓ SUCCESSFULLY DELIVERED & CLEARED".
3. CUSTOM LAWYERS, FIRMS, DATES, WITHHOLDINGS, JURISDICTIONS:
   - Faithfully adapt lawFirmName, lawyerName, signatoryName, signatoryTitle, dates, amounts, and covenants if specified in the user prompt.
   - If independent counsel is requested, use McMahon & Associates or the user's chosen firm. If RPM platform treasury is requested, represent RPM Platform Treasury.

Return ONLY a valid JSON object matching this exact schema:
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
  "confidentialityNotice": string,
  "stampSealType": string
}`;

    const userPrompt = `Client Name: ${targetUser?.name || 'Wayne Bobo'}
Account Reference: ${targetUser?.ref || 'RPM-ACC-WBOBO-2026'}

Description to draft:
${promptDescription}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      return new Response(
        JSON.stringify({
          error: `DeepSeek API returned HTTP ${apiRes.status}`,
          details: errBody,
          fallback: true,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await apiRes.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty response from model', fallback: true }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, receipt: parsed }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message || 'Server error during generation',
        fallback: true,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
