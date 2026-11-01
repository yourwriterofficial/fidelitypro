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
  barLicenseNo?: string;
  confidentialityNotice: string;
  stampSealEnabled?: boolean;
  stampSealType?: string;
  stampSealAngle?: number;
  stampSealColor?: string;
}

/** Default legal template prefilled for general recipient / independent disbursement counsel (No RPM affiliation) */
export function getDefaultReceiptData(userName?: string, userRef?: string, amount?: number): PayoutReceiptData {
  const name = userName || 'Valued Client';
  const ref = userRef || `REF-${name.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'CLIENT'}-2026`;
  const amtFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 75000.00);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    lawFirmName: 'McMahon & Associates',
    lawFirmSubtitle: 'Attorneys at Law · Fiduciary Settlements & Trust Conveyancing',
    lawyerName: 'Dean McMahon, Esq.',
    lawyerTitle: 'Independent Disbursement Counsel',
    lawFirmAddress: '88 Wall Street, Suite 2400, New York, NY 10005',
    lawFirmPhone: '+1 (212) 555-0344',
    lawFirmEmail: 'legal@mcmahonassociates.io',
    receiptNo: `DISB-REC-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    dateOfIssue: today,
    recipientName: name,
    recipientRef: ref,
    subject: 'Official Receipt & Irrevocable Release of Settlement Disbursement',
    salutation: `Dear ${name.split(' ').pop() ? `Mr./Ms. ${name.split(' ').pop()}` : name},`,
    bodyParagraphs: [
      'I write in my official capacity as Independent Fiduciary and Disbursement Counsel to formally confirm and document the conclusive execution of the settlement disbursement process on behalf of the designated beneficiary.',
      'Pursuant to the governing fiduciary escrow instructions and executed settlement agreement, all required conditions precedent, audit disclosures, and regulatory clearance protocols have been completed and verified in full. No outstanding caveats, liens, holds, or encumbrances remain attached to this settlement.',
      `In accordance with executed banking wire instructions, the total settlement proceeds of ${amtFormatted} have been irrevocably released and dispatched to your designated beneficiary account via authorized Federal Reserve clearance rails. The undersigned counsel and depository agents are hereby fully discharged of further custody liability with respect to these assets.`,
      'This instrument constitutes definitive, legally binding proof of executed conveyance. Please retain this original attestation within your permanent financial, legal, and taxation archives as conclusive evidence of completed disbursement.'
    ],
    schedulePayee: name,
    scheduleAccountRef: ref,
    grossAmount: amtFormatted,
    netDisbursed: amtFormatted,
    effectiveDate: today,
    transactionRef: `FED-WIRE-${Math.floor(1000000 + Math.random() * 9000000)}-EFT`,
    deliveryStatus: '✓ SUCCESSFULLY DELIVERED',
    closingNote: 'Please retain this document within your permanent legal and financial archives as conclusive proof of completed disbursement. This instrument bears the full authority and registered attestation of McMahon & Associates, Attorneys at Law.',
    signoff: 'Yours faithfully,',
    signatoryName: 'Dean McMahon, Esq.',
    signatoryTitle: 'Independent Disbursement Counsel & Special Fiduciary',
    barLicenseNo: 'New York State Bar Reg. #4829104 · Fiduciary Commissioner',
    confidentialityNotice: 'This communication is intended solely for the named recipient and constitutes a privileged and confidential legal document. Unauthorised review, use, disclosure, or distribution is strictly prohibited.',
    stampSealEnabled: true,
    stampSealType: 'universal-notary-crimson',
    stampSealAngle: -5,
    stampSealColor: '#b91c1c',
  };
}

/** Get DeepSeek / AI API key from secure sources */
export async function getDeepSeekApiKey(): Promise<string> {
  // 1. Check local storage if admin configured in browser
  if (typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('rpm_deepseek_api_key');
    if (local?.trim()) return local.trim();
  }

  // 2. Check Supabase settings table
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'deepseek_api_key').maybeSingle();
    if (data?.value?.trim()) return data.value.trim();
  } catch (err) {
    console.warn('[AI] Could not fetch deepseek_api_key from settings:', err);
  }

  // 3. Check environment
  const envKey = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || (import.meta as any).env?.DEEPSEEK_API_KEY;
  return envKey || '';
}

/** Get Gemini API Key */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'gemini_api_key').maybeSingle();
    if (data?.value?.trim()) return data.value.trim();
  } catch (err) {
    console.warn('[AI] Could not fetch gemini_api_key from settings:', err);
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  return envKey || '';
}

/**
 * Generate receipt data using DeepSeek API with server-side proxy & fallback
 */
export async function generateReceiptWithGemini(
  promptDescription: string,
  targetUser?: { name: string; ref?: string; balance?: number; amount?: number }
): Promise<PayoutReceiptData> {
  return generateReceiptWithAI(promptDescription, targetUser);
}

export async function generateReceiptWithAI(
  promptDescription: string,
  targetUser?: { name: string; ref?: string; balance?: number; amount?: number }
): Promise<PayoutReceiptData> {
  const deepseekKey = await getDeepSeekApiKey();

  // Tier 1: Call secure, untraceable backend serverless proxy (/api/generate-receipt)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    const proxyRes = await fetch('/api/generate-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptDescription,
        targetUser,
        apiKey: deepseekKey || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json?.success && json?.receipt) {
        return {
          ...getDefaultReceiptData(targetUser?.name, targetUser?.ref, targetUser?.balance),
          ...json.receipt,
          bodyParagraphs: Array.isArray(json.receipt.bodyParagraphs)
            ? json.receipt.bodyParagraphs
            : [json.receipt.bodyParagraphs || ''],
        };
      }
    }
  } catch (err) {
    console.warn('[AI] Backend proxy skipped or unreachable; proceeding to direct resolution');
  }

  // Tier 2: Direct call to DeepSeek API if client has key
  if (deepseekKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are an elite legal and corporate drafting counsel.
Analyze the user's intent:
1. If the instruction is a PRE-DISBURSEMENT CONDITION or DEMAND (e.g. Wayne needs to collect and provide his account statement before being paid):
   - Draft a formal CONDITIONAL ESCROW HOLD & STATEMENT REQUISITION NOTICE.
   - State clearly that funds ($X) are in secure escrow, but cannot be disbursed until the beneficiary obtains, certifies, and submits their official Statement of Account.
   - Set deliveryStatus to: "⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING".
2. If the instruction confirms completed release (statement verified, funds delivered):
   - Draft an OFFICIAL RECEIPT AND IRREVOCABLE RELEASE OF SETTLEMENT DISBURSEMENT.
   - Set deliveryStatus to: "✓ SUCCESSFULLY DELIVERED & CLEARED".
3. Adapt all fields (lawyer, firm, amounts, dates, covenants, stampSealType) to faithfully match the user prompt.

Return pure JSON matching:
{"lawFirmName":string,"lawFirmSubtitle":string,"lawyerName":string,"lawyerTitle":string,"lawFirmAddress":string,"lawFirmPhone":string,"lawFirmEmail":string,"receiptNo":string,"dateOfIssue":string,"recipientName":string,"recipientRef":string,"subject":string,"salutation":string,"bodyParagraphs":string[],"schedulePayee":string,"scheduleAccountRef":string,"grossAmount":string,"netDisbursed":string,"effectiveDate":string,"transactionRef":string,"deliveryStatus":string,"closingNote":string,"signoff":string,"signatoryName":string,"signatoryTitle":string,"confidentialityNotice":string,"stampSealType":string}`,
            },
            {
              role: 'user',
              content: `Beneficiary: ${targetUser?.name || 'Wayne Bobo'}
Account Reference: ${targetUser?.ref || 'RPM-ACC-WBOBO-2026'}
Instructions: ${promptDescription}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.15,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        const rawContent = dsJson?.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          return {
            ...getDefaultReceiptData(targetUser?.name, targetUser?.ref, targetUser?.balance),
            ...parsed,
            bodyParagraphs: Array.isArray(parsed.bodyParagraphs)
              ? parsed.bodyParagraphs
              : [parsed.bodyParagraphs || ''],
          };
        }
      }
    } catch (err) {
      console.warn('[AI] Direct DeepSeek call encountered an issue:', err);
    }
  }

  // Tier 3: Direct call to Gemini API if key is available
  const geminiKey = await getGeminiApiKey();
  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Draft a formal legal instrument in pure JSON format for beneficiary ${
                      targetUser?.name || 'Wayne Bobo'
                    } based on description:\n${promptDescription}\n\nAnalyze intent: if prompt states a condition precedent (e.g. Wayne needs to collect and provide statement before being paid), draft a CONDITIONAL ESCROW HOLD & STATEMENT REQUISITION NOTICE with status "⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING". If confirmed release, draft official receipt with "✓ SUCCESSFULLY DELIVERED & CLEARED". Adapt all fields to suit prompt.\n\nSchema: {"lawFirmName":string,"lawFirmSubtitle":string,"lawyerName":string,"lawyerTitle":string,"lawFirmAddress":string,"lawFirmPhone":string,"lawFirmEmail":string,"receiptNo":string,"dateOfIssue":string,"recipientName":string,"recipientRef":string,"subject":string,"salutation":string,"bodyParagraphs":string[],"schedulePayee":string,"scheduleAccountRef":string,"grossAmount":string,"netDisbursed":string,"effectiveDate":string,"transactionRef":string,"deliveryStatus":string,"closingNote":string,"signoff":string,"signatoryName":string,"signatoryTitle":string,"confidentialityNotice":string,"stampSealType":string}`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.2 },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (geminiRes.ok) {
        const gData = await geminiRes.json();
        const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return {
            ...getDefaultReceiptData(targetUser?.name, targetUser?.ref, targetUser?.balance),
            ...parsed,
            bodyParagraphs: Array.isArray(parsed.bodyParagraphs)
              ? parsed.bodyParagraphs
              : [parsed.bodyParagraphs || ''],
          };
        }
      }
    } catch (err) {
      console.warn('[AI] Gemini call encountered an issue:', err);
    }
  }

  // Tier 4: Intelligent Deterministic Legal Reasoning Engine (Guaranteed Instant Response)
  return synthesizeLegalReceiptFromPrompt(promptDescription, targetUser);
}

/**
 * High-fidelity deterministic legal synthesizer.
 * Parses ANY user prompt and updates all fields, subject lines, body paragraphs,
 * and delivery status accordingly. Handles conditional holds, statement requisitions,
 * custom lawyers, amounts, dates, and authentic stamp seals.
 */
export function synthesizeLegalReceiptFromPrompt(
  promptDescription: string,
  targetUser?: { name: string; ref?: string; balance?: number }
): PayoutReceiptData {
  const p = promptDescription.trim();
  const lower = p.toLowerCase();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. Extract Beneficiary Name (prompt takes precedence over default)
  const nameMatch =
    p.match(/(?:payout to|release to|delivered to|disbursed to|beneficiary|for|wayne|client)\s+([A-Za-z\s]+?)(?=\s+(?:of|\$|from|after|for|releasing|having|needs|must|to|prior))/i) ||
    p.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:needs|must|requires|has)/i);

  let beneficiary = targetUser?.name || 'Wayne Bobo';
  if (lower.includes('wayne') || lower.includes('bobo')) {
    beneficiary = 'Wayne Bobo';
  } else if (nameMatch && nameMatch[1]?.trim() && nameMatch[1].trim().length > 2) {
    const rawFound = nameMatch[1].trim();
    if (!['receipt', 'legal', 'funds', 'escrow', 'account'].includes(rawFound.toLowerCase())) {
      beneficiary = rawFound;
    }
  }

  const accountRef =
    targetUser?.ref ||
    `RPM-ACC-${beneficiary.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'WBOBO'}-2026`;

  // 2. Extract Amount
  let amountStr = '';
  const amtMatch =
    p.match(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/) ||
    p.match(/([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)\s*(?:USD|dollars)?/i);

  if (amtMatch && amtMatch[1]) {
    const rawVal = amtMatch[1].replace(/,/g, '');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      amountStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parsed);
    }
  }

  if (!amountStr) {
    if (targetUser?.balance && targetUser.balance > 0) {
      amountStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(targetUser.balance);
    } else {
      amountStr = '$78,958.00';
    }
  }

  // 3. Extract Custom Date if specified
  let effectiveDate = today;
  const dateMatch = p.match(/(?:dated|effective|as of|on)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (dateMatch && dateMatch[1]) {
    effectiveDate = dateMatch[1];
  }

  // 4. Intent Detection: Pre-Disbursement Statement Requisition vs Confirmed Release
  const isStatementRequiredBeforePayout =
    lower.includes('collect and provide') ||
    lower.includes('provide the account statement before') ||
    lower.includes('before he is paid') ||
    lower.includes('before she is paid') ||
    lower.includes('before they are paid') ||
    lower.includes('before being paid') ||
    lower.includes('before payout') ||
    lower.includes('before disbursement') ||
    lower.includes('statement needed') ||
    lower.includes('statement required') ||
    lower.includes('needs to collect') ||
    lower.includes('must provide') ||
    lower.includes('pending statement') ||
    lower.includes('hold until statement') ||
    lower.includes('statement requisition') ||
    lower.includes('demand statement') ||
    lower.includes('prerequisite');

  const isRpmEntity =
    lower.includes('rpm platform') ||
    lower.includes('rpm treasury') ||
    lower.includes('corporate directive') ||
    lower.includes('platform directive') ||
    lower.includes('rema profit machine treasury');

  // 5. Entity & Signatory
  let lawFirm = 'McMahon & Associates';
  let lawFirmSubtitle = 'Attorneys at Law · Fiduciary Settlements & Escrow Conveyancing';
  let lawFirmAddress = '88 Wall Street, Suite 2400, New York, NY 10005';
  let lawFirmPhone = '+1 (212) 555-0344';
  let lawFirmEmail = 'legal@mcmahonassociates.io';
  let lawyerName = 'Dean McMahon, Esq.';
  let signatory = 'Dean McMahon';
  let signatoryTitle = 'Independent Disbursement Counsel & Special Fiduciary';
  let barLicense = 'New York State Bar Reg. #4829104 · Fiduciary Commissioner';
  let defaultSeal = isRpmEntity ? 'rpm-treasury-emerald' : 'universal-notary-crimson';

  if (isRpmEntity) {
    lawFirm = 'Rema Profit Machine (RPM) Platform Treasury';
    lawFirmSubtitle = 'Settlement Administration, Compliance Clearance & Platform Fiduciary Directorate';
    lawFirmAddress = 'RPM Corporate Center, 100 Financial Plaza, New York, NY 10004';
    lawFirmPhone = '+1 (800) 555-RPM-EXEC';
    lawFirmEmail = 'support@remaprofitmachine.com';
    lawyerName = 'Marcus Sterling';
    signatory = 'Marcus Sterling';
    signatoryTitle = 'Head of Treasury Operations & Regulatory Clearance';
    barLicense = 'RPM Platform Officer ID #RPM-TREAS-8812 · Fiduciary Controller';
    defaultSeal = 'rpm-treasury-emerald';
  } else if (lower.includes('lawyer') || lower.includes('attorney') || lower.includes('counsel')) {
    const lawyerMatch = p.match(/(?:lawyer|attorney|counsel)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (lawyerMatch && lawyerMatch[1] && !lawyerMatch[1].toLowerCase().includes('dean')) {
      signatory = lawyerMatch[1].trim();
      lawyerName = `${signatory}, Esq.`;
      lawFirm = `${signatory} Legal Group`;
      lawFirmEmail = `legal@${signatory.toLowerCase().replace(/[^a-z]/g, '')}law.com`;
    }
  }

  // Check for specific seals requested
  if (lower.includes('apostille') || lower.includes('hague')) {
    defaultSeal = 'universal-apostille';
  } else if (lower.includes('gold') || lower.includes('medallion')) {
    defaultSeal = isRpmEntity ? 'rpm-gold-executive' : 'universal-gold-embossed';
  } else if (lower.includes('navy') || lower.includes('fiduciary seal')) {
    defaultSeal = 'universal-fiduciary-navy';
  } else if (lower.includes('compliance seal') || lower.includes('blue seal')) {
    defaultSeal = 'rpm-compliance-blue';
  }

  // 6. Formulate Document Content based on Scenario
  let subject = '';
  let deliveryStatus = '';
  let bodyParagraphs: string[] = [];
  let closingNote = '';
  let confidentialityNotice = '';
  let receiptNo = isRpmEntity
    ? `RPM-TREAS-2026-${Math.floor(100000 + Math.random() * 900000)}`
    : `DISB-REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  if (isStatementRequiredBeforePayout) {
    // ── SCENARIO A: MANDATORY STATEMENT REQUISITION / CONDITIONAL ESCROW HOLD ──
    subject = isRpmEntity
      ? `RPM Platform Directive: Mandatory Account Statement Verification Required Prior to Capital Release (${amountStr})`
      : `Conditional Escrow Hold Notice — Mandatory Requisition for Certified Account Statement Prior to Disbursement (${amountStr})`;

    deliveryStatus = '⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING';

    bodyParagraphs = isRpmEntity
      ? [
          `This official directive is issued by the Platform Treasury & Settlement Directorate of Rema Profit Machine (RPM) to ${beneficiary} (Account Ref: ${accountRef}) regarding your pending capital withdrawal of ${amountStr} USD.`,
          `NOTICE IS HEREBY GIVEN that pursuant to Platform Security Protocol §8.4, Bank Secrecy Act guidelines, and anti-fraud clearinghouse covenants, your capital withdrawal is currently in an administrative HOLD status. Release of funds is strictly contingent upon you generating, certifying, and submitting your official 5-page RPM Statement of Account.`,
          `Your liquid balance has been segregated and positioned in secure clearing escrow. However, institutional clearance rails require the beneficiary's certified Statement of Account to reconcile transaction ledger hashes, confirm verified identity, and substantiate uninterrupted account continuity prior to external bank remittance.`,
          `Please access the Statement Desk within your RPM investor dashboard or contact platform operations at support@remaprofitmachine.com to furnish your certified statement. Upon digital submission and audit clearance, your full net balance of ${amountStr} will disburse unconditionally within twenty-four (24) business hours.`
        ]
      : [
          `I write in my official capacity as Independent Fiduciary and Disbursement Counsel to formally advise ${beneficiary} regarding the status and disbursement schedule of your settlement proceeds totaling ${amountStr} USD.`,
          `NOTICE IS HEREBY SERVED that pursuant to Section 14(b) of the Uniform Fiduciary Conveyance Standards and Federal Reserve clearance rules, an administrative ESCROW HOLD has been formally entered against account reference ${accountRef}. Full execution of this disbursement is strictly conditional upon you collecting, certifying, and submitting your official 5-page Statement of Account.`,
          `The settlement proceeds have been segregated in secure depository escrow. However, regulatory directives prohibit final banking wire remittance until your verified Statement of Account is presented to this desk to establish clean source of funds and eliminate secondary lien exposure.`,
          `Upon your submission and our forensic validation of the certified Statement of Account, the escrow hold will be dissolved immediately, and irrevocable wire transfer dispatch authorized within twenty-four (24) business hours. Please transmit the required instrument promptly to prevent escrow expiration.`
        ];

    closingNote = isRpmEntity
      ? `This directive is registered in the RPM Platform permanent audit ledger. Payout remains paused until the certified Statement of Account is received and validated.`
      : `This escrow hold constitutes a binding legal prerequisite. Wire release will execute promptly upon receipt and verification of the certified Statement of Account.`;

    confidentialityNotice = `STATUTORY REQUISITION NOTICE: Privileged communication. Settlement disbursement remains subject to the mandatory fulfillment of the certified Statement of Account condition precedent.`;
  } else {
    // ── SCENARIO B: CONFIRMED DISBURSEMENT & RELEASE RECEIPT ──
    const hasPriorStatementMention = lower.includes('statement') || lower.includes('account statement');

    subject = hasPriorStatementMention
      ? `Release of Settlement Funds (${amountStr}) — Confirmed Receipt Following Verified Account Statement Submission`
      : `Official Receipt & Irrevocable Release of Settlement Disbursement (${amountStr})`;

    deliveryStatus = '✓ SUCCESSFULLY DELIVERED & CLEARED';

    bodyParagraphs = hasPriorStatementMention
      ? [
          `I write in my capacity as Independent Disbursement Counsel to formally confirm and document the conclusive execution of the fund release process on behalf of the designated beneficiary, ${beneficiary}.`,
          `Pursuant to governing fiduciary escrow terms, the mandatory condition precedent requiring the formal submission, audit, and verification of the official certified 5-page Statement of Account has been satisfied in full for account ${accountRef}. All compliance checks and regulatory clearances have been rendered unconditional.`,
          `In accordance with executed banking wire instructions, the total settlement proceeds of ${amountStr} USD have been cleared and delivered via irrevocable Federal Reserve wire rails, discharging the undersigned of further custody or depository liability with respect to these assets.`,
          `This instrument serves as definitive, legally binding proof of executed conveyance. Please retain this original attestation within your permanent financial and taxation archives as conclusive evidence of completed disbursement.`
        ]
      : [
          `I write in my capacity as Independent Disbursement Counsel to formally confirm and document the conclusive execution of the fund release process on behalf of the designated beneficiary, ${beneficiary}.`,
          `Following thorough verification of all supporting conveyancing documentation, compliance audits, and regulatory escrow authorizations in respect of account ${accountRef}, all precedent covenants have been comprehensively fulfilled with zero remaining stipulations.`,
          `Upon complete verification and internal fiduciary clearance, this office has disbursed and released the total gross settlement sum of ${amountStr} USD. The funds have been confirmed as delivered to ${beneficiary} in full via authorized clearance rails.`,
          `This receipt serves as definitive, legally binding proof of executed delivery. Please retain this original instrument within your permanent legal and financial dossier as conclusive evidence of completed conveyance.`
        ];

    closingNote = `Please retain this document alongside your official certified records. This instrument bears the full legal authority and registered attestation of ${lawFirm}.`;
    confidentialityNotice = `PRIVILEGED & CONFIDENTIAL: Intended solely for ${beneficiary}. This instrument establishes completed conveyance and irrevocable release of fiduciary escrow liability.`;
  }

  return {
    lawFirmName: lawFirm,
    lawFirmSubtitle: lawFirmSubtitle,
    lawyerName: lawyerName,
    lawyerTitle: signatoryTitle,
    lawFirmAddress: lawFirmAddress,
    lawFirmPhone: lawFirmPhone,
    lawFirmEmail: lawFirmEmail,
    receiptNo: receiptNo,
    dateOfIssue: effectiveDate,
    recipientName: beneficiary,
    recipientRef: accountRef,
    subject: subject,
    salutation: `Dear ${beneficiary.split(' ').length > 1 ? `Mr./Ms. ${beneficiary.split(' ').slice(1).join(' ')}` : beneficiary},`,
    bodyParagraphs: bodyParagraphs,
    schedulePayee: beneficiary,
    scheduleAccountRef: accountRef,
    grossAmount: amountStr,
    netDisbursed: isStatementRequiredBeforePayout ? `${amountStr} (Held in Escrow)` : amountStr,
    effectiveDate: effectiveDate,
    transactionRef: `FED-WIRE-${Math.floor(1000000 + Math.random() * 9000000)}-EFT`,
    deliveryStatus: deliveryStatus,
    closingNote: closingNote,
    signoff: 'Yours faithfully,',
    signatoryName: signatory,
    signatoryTitle: signatoryTitle,
    barLicenseNo: barLicense,
    confidentialityNotice: confidentialityNotice,
    stampSealEnabled: true,
    stampSealType: defaultSeal,
    stampSealAngle: -5,
    stampSealColor: isRpmEntity ? '#047857' : '#b91c1c',
  };
}
