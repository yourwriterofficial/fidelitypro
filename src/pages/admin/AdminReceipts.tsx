import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  Paperclip,
  Check,
  RotateCcw,
  FileText,
  User,
  Lock,
  Search,
  Mail,
  Send,
  X,
  Layers,
  Building2,
  Scale,
  CheckCircle2,
  HelpCircle,
  Download,
  Copy,
  Undo2,
  Info,
  Award,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  type PayoutReceiptData,
  getDefaultReceiptData,
  generateReceiptWithAI,
} from '../../lib/geminiReceiptService';
import {
  LEGAL_LETTER_TEMPLATES,
  type LegalLetterTemplate,
} from '../../data/legalLetterTemplates';
import {
  LegalStampSeal,
  SEAL_DEFINITIONS,
  renderSealSvgString,
} from '../../components/documents/LegalStampSeal';
import { sendSupportOutboundEmail } from '../../lib/supportInboxService';
import { toast } from 'sonner';

/**
 * Normalizes signatory representations:
 * - Extracts clean cursive signature (without academic/bar post-nominals like Esq., CAMS, CFE)
 * - Produces formal bold displayName
 * - Strips any redundant name repeated at the start of rawTitle
 */
export function getCleanSignatoryDetails(name: string, rawTitle: string) {
  const cleanName = (name || '').trim();
  const cursiveSignature =
    cleanName.replace(/,?\s*(Esq\.?|CAMS|CFE|Ret\.?|J\.?D\.?|LL\.?M\.?|CPA|M\.?D\.?)/gi, '').trim() || cleanName;

  let cleanTitle = (rawTitle || '').trim();
  if (cleanName) {
    const baseName = cursiveSignature;
    cleanTitle = cleanTitle
      .replace(new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,·\\-–—|:]*\\s*`, 'i'), '')
      .replace(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,·\\-–—|:]*\\s*`, 'i'), '')
      .trim();
  }

  return {
    cursiveSignature: cursiveSignature || 'Dean McMahon',
    displayName: cleanName || 'Dean McMahon, Esq.',
    displayTitle: cleanTitle || rawTitle || 'Independent Disbursement Counsel & Special Fiduciary',
  };
}

interface ProfileOption {
  id: string;
  name: string;
  email: string;
  wallet_balance?: number;
}

export default function AdminReceipts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // User directory
  const [users, setUsers] = useState<ProfileOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('custom');

  // Selected template ID (defaults to template 1: universal non-RPM disbursement)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(LEGAL_LETTER_TEMPLATES[0].id);

  // Receipt & Letter Content State
  const [receipt, setReceipt] = useState<PayoutReceiptData>(() =>
    getDefaultReceiptData('Valued Client', 'REF-CLIENT-2026', 75000.0)
  );

  // History Stack for Undo capability across template switches and AI generations
  const [historyStack, setHistoryStack] = useState<PayoutReceiptData[]>([]);

  // Dossier storage and pending draft states
  const [dossierRecordId, setDossierRecordId] = useState<string | null>(null);
  const [hasStagedInboxDraft, setHasStagedInboxDraft] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);

  // Toggle for financial schedule table visibility
  const [showSchedule, setShowSchedule] = useState<boolean>(true);

  // Custom schedule labels
  const [scheduleLabels, setScheduleLabels] = useState({
    grossLabel: 'Gross Settlement Balance',
    netLabel: 'Net Delivered & Released',
    railLabel: 'Conveyance Rail / Delivery Mode',
    refLabel: 'Federal Reserve / Banking Reference',
  });

  // AI & Action state
  const [prompt, setPrompt] = useState(
    'Disbursement payout receipt to Valued Client of $75,000.00 from independent disbursement lawyer Dean McMahon (McMahon & Associates) releasing held settlement funds following verified execution of agreement.'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [attached, setAttached] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'template' | 'ai' | 'letterhead' | 'content' | 'schedule' | 'seal'>('template');
  const [documentTheme, setDocumentTheme] = useState<'independent' | 'rpm'>('independent');

  // Stamp Seal state (Optional vector legal/corporate seals)
  const [showSeal, setShowSeal] = useState<boolean>(true);
  const [selectedSealId, setSelectedSealId] = useState<string>('universal-notary-crimson');
  const [sealTilt, setSealTilt] = useState<'tilted' | 'upright' | 'angled-right'>('tilted');
  const [sealCategoryFilter, setSealCategoryFilter] = useState<'all' | 'universal' | 'rpm'>('all');

  // Email dispatch modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailCoverNote, setEmailCoverNote] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Printable container ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // ── Fetch users directory ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, wallet_balance')
          .order('name', { ascending: true });

        if (!error && data) {
          setUsers(data);
        }
      } catch (err) {
        console.warn('[AdminReceipts] Could not load profiles list:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // ── Prepopulate from URL params if present ──────────────────────────────────
  useEffect(() => {
    const pUserId = searchParams.get('userId');
    const pName = searchParams.get('name');
    const pRef = searchParams.get('ref');
    const pAmountStr = searchParams.get('amount');
    const pAmount = pAmountStr ? parseFloat(pAmountStr) : undefined;

    if (pName || pUserId) {
      const name = pName || 'Client Recipient';
      const ref = pRef || (pUserId ? `RPM-ACC-${pUserId.slice(0, 6).toUpperCase()}-2026` : undefined);
      const initial = getDefaultReceiptData(name, ref, pAmount || 78958.0);
      setReceipt(initial);
      if (pUserId) {
        setSelectedUserId(pUserId);
        const match = users.find((u) => u.id === pUserId);
        if (match) setEmailRecipient(match.email);
      }
      setPrompt(
        `Disbursement payout receipt to ${name} of $${new Intl.NumberFormat('en-US').format(
          pAmount || 78958.0
        )} from independent disbursement lawyer Dean McMahon releasing held escrow funds after ${name} submitted their verified RPM account statement.`
      );
    }
  }, [searchParams, users]);

  // Filtered users for search input
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  // Handle user selection from directory
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setAttached(false);

    if (userId === 'custom') return;

    const u = users.find((x) => x.id === userId);
    if (!u) return;

    setEmailRecipient(u.email);
    const cleanName = u.name || u.email.split('@')[0];
    const accRef = `RPM-ACC-${u.id.slice(0, 6).toUpperCase()}-2026`;
    const amt = u.wallet_balance && u.wallet_balance > 0 ? u.wallet_balance : 78958.0;

    setReceipt((prev) => ({
      ...prev,
      recipientName: cleanName,
      recipientRef: accRef,
      schedulePayee: cleanName,
      scheduleAccountRef: accRef,
      grossAmount: `$${new Intl.NumberFormat('en-US').format(amt)}`,
      netDisbursed: `$${new Intl.NumberFormat('en-US').format(amt)}`,
      salutation: `Dear ${cleanName.split(' ').length > 1 ? cleanName.split(' ')[0] + ' ' + cleanName.split(' ').slice(1).join(' ') : cleanName},`,
    }));

    setPrompt(
      `Formal disbursement release to ${cleanName} of $${new Intl.NumberFormat('en-US').format(
        amt
      )} releasing held escrow funds following verified submission of their certified RPM statement of account.`
    );
  };

  // ── Push current draft state to history before modifying ───────────────────
  const pushToHistory = (curr: PayoutReceiptData) => {
    setHistoryStack((prev) => [...prev.slice(-14), JSON.parse(JSON.stringify(curr))]);
  };

  // ── Undo Last Edit / Restore Previous Draft ────────────────────────────────
  const handleUndoLastEdit = () => {
    if (historyStack.length === 0) {
      toast.info('No earlier draft states to undo.');
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setReceipt(previous);
    toast.success('Restored previous letter draft.');
  };

  // ── Apply Built-In Template ────────────────────────────────────────────────
  const handleApplyTemplate = (tpl: LegalLetterTemplate) => {
    pushToHistory(receipt);
    setSelectedTemplateId(tpl.id);
    setShowSchedule(tpl.hasSchedule);
    setScheduleLabels(tpl.scheduleLabels);

    // Automatically set design style: RPM-affiliated template gets 'rpm', general/independent gets 'independent'
    if (tpl.id.includes('rpm') || tpl.name.toLowerCase().includes('rpm')) {
      setDocumentTheme('rpm');
    } else {
      setDocumentTheme('independent');
    }

    // Set appropriate default seal
    if (tpl.defaultSealType) {
      setSelectedSealId(tpl.defaultSealType);
    } else if (tpl.id.includes('rpm') || tpl.name.toLowerCase().includes('rpm')) {
      setSelectedSealId('rpm-treasury-emerald');
    } else {
      setSelectedSealId('universal-notary-crimson');
    }

    const currentName = receipt.recipientName || 'Valued Beneficiary';
    const currentRef = receipt.recipientRef || 'REF-CLIENT-2026';
    const currentGross = receipt.grossAmount || tpl.defaultAmount || '$75,000.00';

    setReceipt((prev) => ({
      ...prev,
      lawFirmName: tpl.entityName,
      lawFirmSubtitle: tpl.entitySubtitle,
      lawFirmAddress: tpl.entityAddress,
      lawFirmPhone: tpl.entityContact.split('·')[0]?.trim() || '+1 (212) 555-0344',
      lawFirmEmail: tpl.entityContact.split('·')[1]?.trim() || 'legal@fiduciary-registry.org',
      subject: tpl.documentTitle,
      dateOfIssue: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      salutation: tpl.salutation.replace('Beneficiary', currentName).replace('Capital Partner', currentName),
      bodyParagraphs: tpl.bodyParagraphs.map((p) =>
        p.replace(/beneficiary/gi, currentName).replace(/the designated account holder/gi, currentName)
      ),
      closingNote: tpl.legalAttestation,
      signoff: 'Respectfully submitted,',
      signatoryName: tpl.signatoryName,
      signatoryTitle: tpl.signatoryTitle,
      barLicenseNo: tpl.signatoryBar,
      confidentialityNotice: tpl.confidentialityNotice,
      grossAmount: currentGross,
      netDisbursed: tpl.defaultDeliveryStatus?.includes('HOLD') ? `${currentGross} (Held in Escrow)` : currentGross,
      scheduleAccountRef: currentRef,
      deliveryStatus: tpl.defaultDeliveryStatus || '✓ SUCCESSFULLY DELIVERED',
    }));

    toast.success(`Applied template: "${tpl.name}"`);
  };

  // ── Statement Prerequisite & Requisition Workflow ─────────────────────────
  const handleLoadStatementRequisition = (mode: 'universal' | 'rpm' | 'cleared') => {
    pushToHistory(receipt);
    const currentName = receipt.recipientName || 'Wayne Bobo';
    const currentRef = receipt.recipientRef || 'RPM-ACC-WBOBO-2026';
    const currentGross = receipt.grossAmount || '$78,958.00';

    if (mode === 'universal') {
      const tpl = LEGAL_LETTER_TEMPLATES.find((t) => t.id === 'universal-statement-requisition') || LEGAL_LETTER_TEMPLATES[0];
      setSelectedTemplateId(tpl.id);
      setDocumentTheme('independent');
      setShowSchedule(true);
      setScheduleLabels(tpl.scheduleLabels);
      setSelectedSealId('universal-notary-crimson');
      setShowSeal(true);

      setReceipt((prev) => ({
        ...prev,
        lawFirmName: tpl.entityName,
        lawFirmSubtitle: tpl.entitySubtitle,
        lawFirmAddress: tpl.entityAddress,
        lawFirmPhone: tpl.entityContact.split('·')[0]?.trim() || '+1 (212) 555-0344',
        lawFirmEmail: tpl.entityContact.split('·')[1]?.trim() || 'fiduciary@mcmahonassociates.io',
        subject: `Conditional Escrow Hold Notice — Mandatory Requisition for Certified Account Statement Prior to Disbursement (${currentGross})`,
        salutation: `Dear ${currentName.split(' ').pop() ? `Mr./Ms. ${currentName.split(' ').pop()}` : currentName},`,
        bodyParagraphs: tpl.bodyParagraphs.map((p) => p.replace(/beneficiary/gi, currentName)),
        closingNote: tpl.legalAttestation,
        signoff: 'Respectfully submitted,',
        signatoryName: tpl.signatoryName,
        signatoryTitle: tpl.signatoryTitle,
        barLicenseNo: tpl.signatoryBar,
        confidentialityNotice: tpl.confidentialityNotice,
        grossAmount: currentGross,
        netDisbursed: `${currentGross} (Held in Escrow)`,
        scheduleAccountRef: currentRef,
        deliveryStatus: '⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING',
      }));

      setPrompt(
        `Formal Escrow Notice to ${currentName} placing ${currentGross} on conditional escrow hold until ${currentName} collects and submits their certified 5-page Statement of Account.`
      );
      toast.success(`Loaded Universal Statement Requisition Notice for ${currentName}.`);
    } else if (mode === 'rpm') {
      const tpl = LEGAL_LETTER_TEMPLATES.find((t) => t.id === 'rpm-statement-directive') || LEGAL_LETTER_TEMPLATES[0];
      setSelectedTemplateId(tpl.id);
      setDocumentTheme('rpm');
      setShowSchedule(true);
      setScheduleLabels(tpl.scheduleLabels);
      setSelectedSealId('rpm-treasury-emerald');
      setShowSeal(true);

      setReceipt((prev) => ({
        ...prev,
        lawFirmName: tpl.entityName,
        lawFirmSubtitle: tpl.entitySubtitle,
        lawFirmAddress: tpl.entityAddress,
        lawFirmPhone: '+1 (800) 555-RPM-EXEC',
        lawFirmEmail: 'support@remaprofitmachine.com',
        subject: `RPM Treasury Directive: Mandatory Account Statement Submission Prior to Capital Release (${currentGross})`,
        salutation: `Dear ${currentName},`,
        bodyParagraphs: tpl.bodyParagraphs.map((p) => p.replace(/account holder/gi, currentName).replace(/beneficiary/gi, currentName)),
        closingNote: tpl.legalAttestation,
        signoff: 'Yours faithfully,',
        signatoryName: tpl.signatoryName,
        signatoryTitle: tpl.signatoryTitle,
        barLicenseNo: tpl.signatoryBar,
        confidentialityNotice: tpl.confidentialityNotice,
        grossAmount: currentGross,
        netDisbursed: `${currentGross} (Pending Verification)`,
        scheduleAccountRef: currentRef,
        deliveryStatus: '⏳ CAPITAL WITHDRAWAL HELD — STATEMENT REQUIRED',
      }));

      setPrompt(
        `RPM Platform Treasury Directive to ${currentName} requiring mandatory 5-page Statement of Account submission prior to disbursement clearance of ${currentGross}.`
      );
      toast.success(`Loaded RPM Platform Statement Directive for ${currentName}.`);
    } else {
      // Cleared / Released
      const tpl = LEGAL_LETTER_TEMPLATES.find((t) => t.id === 'escrow-disbursement') || LEGAL_LETTER_TEMPLATES[0];
      handleApplyTemplate(tpl);
      toast.success(`Loaded Conclusive Payout Release (Statement Verified & Approved).`);
    }
  };

  // ── Revert to Baseline Template Defaults ───────────────────────────────────
  const handleRevertToBaseline = () => {
    const tpl = LEGAL_LETTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || LEGAL_LETTER_TEMPLATES[0];
    pushToHistory(receipt);
    handleApplyTemplate(tpl);
    toast.success(`Reverted letter to baseline template "${tpl.name}".`);
  };

  // ── AI Generation via DeepSeek / Gemini ─────────────────────────────────────
  const handleGenerateAI = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a description for the legal letter.');
      return;
    }

    pushToHistory(receipt);
    setIsGenerating(true);
    const toastId = toast.loading('Generating legal instrument with DeepSeek-V3...');

    try {
      const generated = await generateReceiptWithAI(prompt, {
        name: receipt.recipientName,
        ref: receipt.recipientRef,
        amount: parseFloat(receipt.grossAmount.replace(/[^0-9.]/g, '')) || 78958.0,
      });

      setReceipt(generated);
      toast.success('Generated official legal letter with DeepSeek!', { id: toastId });
    } catch (err: any) {
      console.error('[AdminReceipts] Generation error:', err);
      toast.error(err?.message || 'Failed to generate document.', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Helper to build pristine standalone letter HTML ───────────────────────
  const buildReceiptLetterDocumentHtml = (
    rec: PayoutReceiptData,
    theme: 'independent' | 'rpm',
    hasSched: boolean,
    labels: { grossLabel: string; netLabel: string; railLabel: string; refLabel: string }
  ) => {
    const isIndependent = theme === 'independent';
    const { cursiveSignature, displayName, displayTitle } = getCleanSignatoryDetails(
      rec.signatoryName,
      rec.signatoryTitle
    );

    const sealSvgHtml = showSeal
      ? renderSealSvgString({
          sealId: selectedSealId,
          docketNo: rec.receiptNo,
          date: rec.dateOfIssue,
          tiltAngle: sealTilt === 'tilted' ? -5 : sealTilt === 'angled-right' ? 5 : 0,
          size: 130,
        })
      : '';

    const paragraphsHtml = isIndependent
      ? rec.bodyParagraphs
          .map((p) => `<p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.7; color: #1e293b; text-align: justify; text-indent: 18px;">${p}</p>`)
          .join('')
      : rec.bodyParagraphs
          .map((p) => `<p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.6; color: #334155;">${p}</p>`)
          .join('');

    const scheduleHtml = hasSched
      ? isIndependent
        ? `
        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" border="0" style="margin: 22px 0; background: #ffffff; border: 1px solid #cbd5e1; font-size: 12px; color: #0f172a; font-family: Georgia, 'Times New Roman', serif;">
          <tr style="background: #f1f5f9; color: #0f172a; border-bottom: 2px solid #0f172a;"><th align="left" style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Schedule of Settlement &amp; Disbursement Ledger</th><th align="right" style="padding: 10px 14px; font-size: 10px; font-family: monospace; font-weight: bold; color: #334155;">[OFFICIALLY ATTESTED]</th></tr>
          <tr><td style="color: #475569; border-bottom: 1px solid #e2e8f0; padding: 9px 14px;">${labels.grossLabel}</td><td align="right" style="font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 9px 14px;">${rec.grossAmount} USD</td></tr>
          <tr style="background: #f8fafc;"><td style="color: #0f172a; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">${labels.netLabel}</td><td align="right" style="font-weight: 800; color: #0f172a; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">${rec.netDisbursed} USD</td></tr>
          <tr><td style="color: #475569; border-bottom: 1px solid #e2e8f0; padding: 9px 14px;">Effective Date of Execution</td><td align="right" style="border-bottom: 1px solid #e2e8f0; padding: 9px 14px;">${rec.effectiveDate}</td></tr>
          <tr><td style="color: #475569; padding: 9px 14px;">${labels.refLabel}</td><td align="right" style="font-family: monospace; color: #334155; padding: 9px 14px;">${rec.transactionRef}</td></tr>
        </table>
        `
        : `
        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" border="0" style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #1e293b;">
          <tr style="background: #0f172a; color: #ffffff;"><th colspan="2" align="left" style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Disbursement Schedule Summary</th></tr>
          <tr><td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">${labels.grossLabel}</td><td align="right" style="font-weight: 700; border-bottom: 1px solid #e2e8f0;">${rec.grossAmount} USD</td></tr>
          <tr><td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">${labels.netLabel}</td><td align="right" style="font-weight: 800; color: #047857; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${rec.netDisbursed} USD</td></tr>
          <tr><td style="color: #64748b; border-bottom: 1px solid #e2e8f0;">Effective Date</td><td align="right" style="border-bottom: 1px solid #e2e8f0;">${rec.effectiveDate}</td></tr>
          <tr><td style="color: #64748b;">${labels.refLabel}</td><td align="right" style="font-family: monospace;">${rec.transactionRef}</td></tr>
        </table>
        `
      : '';

    if (isIndependent) {
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-radius: 8px; overflow: hidden; font-family: Georgia, 'Times New Roman', serif, -apple-system; color: #0f172a;">
          <tr>
            <td style="padding: 32px 36px 20px 36px; text-align: center; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #64748b;">Official Legal Instrument · Privileged &amp; Sworn</p>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #0f172a; line-height: 1.2;">${rec.lawFirmName}</h1>
              <p style="margin: 0; font-size: 13px; font-style: italic; color: #475569;">${rec.lawFirmSubtitle}</p>
              <p style="margin: 10px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">${rec.lawFirmAddress} · ${rec.lawFirmPhone} · ${rec.lawFirmEmail}</p>
              <div style="border-top: 2px solid #0f172a; border-bottom: 1px solid #0f172a; height: 2px; margin-top: 20px;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; font-size: 11px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <tr>
                  <td><strong>DATE OF EXECUTION:</strong> ${rec.dateOfIssue}</td>
                  <td align="right"><strong>DOCKET REFERENCE:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${rec.receiptNo}</span></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 10px;">
                    <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">BENEFICIARY OF RECORD:</span><br/>
                    <strong style="font-size: 14px; color: #0f172a;">${rec.recipientName}</strong> <span style="color: #64748b; font-size: 11px;">(${rec.recipientRef})</span>
                  </td>
                </tr>
              </table>

              <div style="padding: 12px 16px; background: #f8fafc; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: center; margin: 20px 0 24px 0;">
                <p style="margin: 0 0 4px 0; font-size: 9px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b;">OFFICIAL LEGAL MATTER &amp; NOTICE OF CONVEYANCE</p>
                <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase;">IN RE: ${rec.subject}</h2>
              </div>

              <p style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">${rec.salutation}</p>

              <div style="font-size: 13px; line-height: 1.7; color: #1e293b; text-align: justify;">
                ${paragraphsHtml}
              </div>

              ${scheduleHtml}

              <div style="margin: 24px 0; padding: 12px 16px; border-left: 2px solid #0f172a; background: #fafafa; font-style: italic; font-size: 12px; color: #334155;">
                ${rec.closingNote}
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td valign="top" style="width: ${showSeal ? '45%' : '58%'};">
                    <p style="font-size: 12px; color: #475569; margin: 0 0 10px 0;">${rec.signoff}</p>
                    <p style="font-size: 22px; font-style: italic; color: #0f172a; margin: 0 0 6px 0;">${cursiveSignature}</p>
                    <div style="height: 1px; width: 180px; background: #0f172a; margin-bottom: 6px;"></div>
                    <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0;">${displayName}</p>
                    <p style="font-size: 11px; color: #475569; margin: 2px 0 0 0;">${displayTitle}</p>
                    <p style="font-size: 10px; font-family: monospace; color: #64748b; margin: 2px 0 0 0;">${rec.barLicenseNo || rec.lawFirmName}</p>
                  </td>
                  ${showSeal ? `
                  <td valign="middle" align="center" style="width: 25%; padding: 0 8px;">
                    ${sealSvgHtml}
                  </td>` : ''}
                  <td valign="top" align="right" style="width: ${showSeal ? '30%' : '42%'};">
                    <div style="border: 2px solid #0f172a; padding: 12px; background: #fafafa; text-align: right; max-width: 220px; display: inline-block;">
                      <p style="margin: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0f172a;">NOTARIAL JURAT &amp; SEAL</p>
                      <p style="margin: 4px 0 0 0; font-size: 9px; font-family: monospace; font-weight: 700; color: #334155;">DOCKET: ${rec.receiptNo}</p>
                      <p style="margin: 4px 0 0 0; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; line-height: 1.3;">SWORN &amp; RECORDED UNDER OFFICIAL ATTESTATION · INDEPENDENT REGISTRY</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 9.5px; color: #64748b; line-height: 1.5; font-style: italic;">
                ${rec.confidentialityNotice}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 36px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
              Dispatched via Official Legal &amp; Fiduciary Disbursement Registry. Privileged Attorney-Client Communication.
            </td>
          </tr>
        </table>
      `;
    } else {
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
          <tr>
            <td style="background: #0f172a; padding: 24px 28px; color: #ffffff;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #10b981;">Privileged Legal Communication</p>
              <h1 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; line-height: 1.3;">${rec.lawFirmName}</h1>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">${rec.lawFirmSubtitle}</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">${rec.lawFirmAddress} · ${rec.lawFirmPhone} · ${rec.lawFirmEmail}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; font-size: 12px;">
                <tr>
                  <td><strong>DATE OF ISSUE:</strong> ${rec.dateOfIssue}</td>
                  <td align="right"><strong>REFERENCE ID:</strong> <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${rec.receiptNo}</span></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 10px;"><strong>BENEFICIARY:</strong> ${rec.recipientName} (${rec.recipientRef})</td>
                </tr>
              </table>

              <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #047857; padding-left: 10px; margin: 20px 0 16px 0;">
                ${rec.subject}
              </h2>

              <p style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">${rec.salutation}</p>

              ${paragraphsHtml}

              ${scheduleHtml}

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td valign="top" style="width: ${showSeal ? '45%' : '58%'};">
                    <p style="font-size: 12px; color: #475569; font-style: italic; margin-bottom: 12px;">${rec.closingNote}</p>
                    <p style="font-size: 20px; font-family: Georgia, serif; font-style: italic; color: #0f172a; margin: 0 0 6px 0;">${cursiveSignature}</p>
                    <div style="height: 1px; width: 160px; background: #0f172a; margin-bottom: 6px;"></div>
                    <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0;">${displayName}</p>
                    <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">${displayTitle}</p>
                    <p style="font-size: 10px; color: #94a3b8; margin: 2px 0 0 0;">${rec.barLicenseNo || rec.lawFirmName}</p>
                  </td>
                  ${showSeal ? `
                  <td valign="middle" align="center" style="width: 25%; padding: 0 8px;">
                    ${sealSvgHtml}
                  </td>` : ''}
                  <td valign="top" align="right" style="width: ${showSeal ? '30%' : '42%'};">
                    <div style="border: 1px solid #10b981; border-radius: 8px; padding: 12px; background: #ecfdf5; text-align: right; max-width: 220px; display: inline-block;">
                      <p style="margin: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #065f46;">RPM COMPLIANCE CLEARANCE</p>
                      <p style="margin: 4px 0 0 0; font-size: 9px; font-family: monospace; font-weight: 700; color: #047857;">REG: ${rec.receiptNo}</p>
                      <p style="margin: 4px 0 0 0; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #047857; line-height: 1.3;">VERIFIED &amp; RECORDED IN RPM PERMANENT ARCHIVE</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; line-height: 1.5; font-family: monospace;">
                ${rec.confidentialityNotice}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              Dispatched securely via Official Legal &amp; Disbursement Desk (support@remaprofitmachine.com).
            </td>
          </tr>
        </table>
      `;
    }
  };

  // ── Print / Save PDF (Isolated pure letter printing via hidden iframe, zero UI chrome) ────────
  const handlePrint = () => {
    const el = document.getElementById('admin-receipt-printable');
    if (!el) {
      window.print();
      return;
    }

    try {
      // Remove any prior print frame
      const existing = document.getElementById('rpm-receipt-print-frame');
      if (existing) {
        existing.remove();
      }

      // Create hidden sandbox iframe for 100% popup-blocker-immune, pure-document printing
      const iframe = document.createElement('iframe');
      iframe.id = 'rpm-receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((s) => s.outerHTML)
        .join('\n');

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8"/>
              <title>${receipt.subject || 'Official Legal Instrument'}</title>
              ${styles}
              <style>
                @page {
                  size: auto;
                  margin: 10mm 14mm;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body {
                  background: #ffffff !important;
                  color: #0f172a !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  font-family: Georgia, 'Times New Roman', serif, -apple-system, sans-serif;
                }
                .printable-canvas {
                  max-width: 820px;
                  margin: 0 auto;
                  padding: 0;
                  background: #ffffff;
                }
              </style>
            </head>
            <body class="bg-white">
              <div class="printable-canvas">
                ${el.innerHTML}
              </div>
            </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (pErr) {
            console.warn('[Print] Iframe print execution error, falling back to window.print():', pErr);
            window.print();
          }
        }, 250);
        return;
      }
    } catch (popupErr) {
      console.warn('[Print] Print iframe setup error, falling back to window.print():', popupErr);
    }

    // Fallback directly to hardened window.print()
    window.print();
  };

  // ── Copy HTML to Clipboard ────────────────────────────────────────────────
  const handleCopyHtml = async () => {
    const html = buildReceiptLetterDocumentHtml(receipt, documentTheme, showSchedule, scheduleLabels);
    try {
      await navigator.clipboard.writeText(html);
      toast.success('Document HTML copied to clipboard!');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  // ── Download Standalone HTML File ──────────────────────────────────────────
  const handleDownloadHtml = () => {
    const html = buildReceiptLetterDocumentHtml(receipt, documentTheme, showSchedule, scheduleLabels);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(receipt.subject || 'legal_instrument').replace(/[^a-zA-Z0-9_-]/g, '_')}_${receipt.receiptNo}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded legal instrument HTML file!');
  };

  // ── Transfer Customized Letter to Support Inbox as Attachment ──────────────
  const handleTransferToSupportInbox = () => {
    let targetEmail = emailRecipient.trim();
    if (!targetEmail && selectedUserId !== 'custom') {
      const match = users.find((u) => u.id === selectedUserId);
      if (match?.email) targetEmail = match.email;
    }

    if (!targetEmail) {
      toast.error('Please specify a recipient email address or select a user before transferring to Support Inbox.');
      return;
    }

    const documentHtml = buildReceiptLetterDocumentHtml(
      receipt,
      documentTheme,
      showSchedule,
      scheduleLabels
    );

    const draftPayload = {
      to: targetEmail,
      recipientName: receipt.recipientName || 'Valued Client',
      recipientUserId: selectedUserId !== 'custom' ? selectedUserId : undefined,
      subject: '', // Admin writes the email subject
      attachment: {
        id: `att_${Date.now()}`,
        name: `${(receipt.subject || 'legal_instrument').replace(/[^a-zA-Z0-9_-]/g, '_')}_${receipt.receiptNo}.html`,
        title: receipt.subject || 'Official Legal Instrument',
        receiptNo: receipt.receiptNo,
        theme: documentTheme,
        recipientName: receipt.recipientName,
        createdAt: new Date().toISOString(),
        html: documentHtml,
      },
    };

    localStorage.setItem('rpm_support_inbox_pending_draft', JSON.stringify(draftPayload));
    setHasStagedInboxDraft(true);
    toast.success(`Letter attached to draft for ${targetEmail}! Opening Support Inbox...`);
    navigate('/admin/inbox');
  };

  // ── Undo Transfer to Support Inbox ─────────────────────────────────────────
  const handleUndoTransferToSupportInbox = () => {
    try {
      localStorage.removeItem('rpm_support_inbox_pending_draft');
      setHasStagedInboxDraft(false);
      toast.success('Staged Support Inbox draft discarded.');
    } catch {
      // Non-fatal
    }
  };

  // ── Attach to User Dossier (No Email) ──────────────────────────────────────
  const handleAttachToUser = () => {
    try {
      const record = {
        receiptNo: receipt.receiptNo,
        recipientName: receipt.recipientName,
        recipientRef: receipt.recipientRef,
        recipientUserId: selectedUserId !== 'custom' ? selectedUserId : null,
        subject: receipt.subject,
        attachedAt: new Date().toISOString(),
        documentTheme,
        document: receipt,
      };
      localStorage.setItem(`rpm_dossier_${receipt.receiptNo}`, JSON.stringify(record));
      if (selectedUserId && selectedUserId !== 'custom') {
        const userListKey = `rpm_user_dossier_list_${selectedUserId}`;
        const existing = JSON.parse(localStorage.getItem(userListKey) || '[]');
        if (!existing.some((r: any) => r.receiptNo === receipt.receiptNo)) {
          existing.push(record);
          localStorage.setItem(userListKey, JSON.stringify(existing));
        }
      }
      setAttached(true);
      setDossierRecordId(receipt.receiptNo);
      toast.success(
        `Instrument filed in ${receipt.recipientName}'s administrative file. No email was sent.`,
        {
          action: {
            label: 'Undo',
            onClick: () => handleUndoAttachToUser(),
          },
        }
      );
    } catch {
      setAttached(true);
      toast.success(`Receipt attached to ${receipt.recipientName}'s administrative file.`);
    }
  };

  // ── Undo Dossier Attachment ────────────────────────────────────────────────
  const handleUndoAttachToUser = () => {
    try {
      localStorage.removeItem(`rpm_dossier_${receipt.receiptNo}`);
      if (selectedUserId && selectedUserId !== 'custom') {
        const userListKey = `rpm_user_dossier_list_${selectedUserId}`;
        const existing = JSON.parse(localStorage.getItem(userListKey) || '[]');
        const filtered = existing.filter((r: any) => r.receiptNo !== receipt.receiptNo);
        localStorage.setItem(userListKey, JSON.stringify(filtered));
      }
      setAttached(false);
      setDossierRecordId(null);
      toast.success(`Dossier attachment undone. Document detached from ${receipt.recipientName}'s record.`);
    } catch {
      setAttached(false);
    }
  };

  // ── Open Send Email Modal ──────────────────────────────────────────────────
  const handleOpenEmailModal = () => {
    const currentName = receipt.recipientName || 'Valued Client';
    const currentSubject = `Official Legal Instrument: ${receipt.subject} — Ref ${receipt.receiptNo}`;
    const cover = `Dear ${currentName},\n\nPlease find attached your official legal instrument regarding ${receipt.subject}.\n\nThis privileged document has been attested and registered by ${receipt.signatoryName} (${receipt.signatoryTitle}). You may retain this copy for your tax, legal, and financial archives.\n\nWarm regards,\nLegal & Disbursement Desk\nsupport@remaprofitmachine.com`;

    setEmailSubject(currentSubject);
    setEmailCoverNote(cover);
    if (!emailRecipient && selectedUserId !== 'custom') {
      const match = users.find((u) => u.id === selectedUserId);
      if (match) setEmailRecipient(match.email);
    }
    setEmailModalOpen(true);
  };

  // ── Dispatch Email via Support Email (support@remaprofitmachine.com) ────────
  const handleDispatchEmail = async () => {
    if (!emailRecipient || !emailRecipient.includes('@')) {
      toast.error('Please specify a valid recipient email address.');
      return;
    }

    setIsSendingEmail(true);
    const toastId = toast.loading(`Dispatching official email to ${emailRecipient}...`);

    try {
      const documentHtml = buildReceiptLetterDocumentHtml(
        receipt,
        documentTheme,
        showSchedule,
        scheduleLabels
      );

      const fullEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; padding: 24px 12px; margin: 0; color: #1e293b;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 680px; margin: 0 auto 16px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="padding: 24px 28px; background: #fafbfc; border-bottom: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${emailCoverNote}</p>
              </td>
            </tr>
          </table>
          ${documentHtml}
        </body>
        </html>
      `;

      const res = await sendSupportOutboundEmail({
        to: emailRecipient,
        customerName: receipt.recipientName,
        customerUserId: selectedUserId !== 'custom' ? selectedUserId : undefined,
        subject: emailSubject,
        bodyHtml: fullEmailHtml,
        mailboxId: 'mb_support',
        priority: 'high',
      });

      if (res.success) {
        toast.success(`Legal instrument emailed to ${emailRecipient}!`, { id: toastId });
        setEmailModalOpen(false);
      } else {
        toast.error(`Dispatch warning: ${res.error || 'Failed to deliver'}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error sending email', { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const updateField = (field: keyof PayoutReceiptData, val: any) => {
    setReceipt((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-6 min-h-screen font-sans text-slate-800 print:m-0 print:p-0 print:bg-white">
      {/* ── Strict Print Styles (Guarantees ONLY the actual letter canvas prints) ── */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm 14mm;
          }
          html, body, #root {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
          }
          /* 1. HIDE ALL parent and sibling elements by default */
          body * {
            visibility: hidden !important;
          }
          /* 2. Make ONLY the printable document and its children visible */
          #admin-receipt-printable,
          #admin-receipt-printable * {
            visibility: visible !important;
          }
          /* 3. Snap the document to page origin with multi-page flow */
          #admin-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            page-break-inside: auto !important;
          }
          /* 4. Eradicate all layout chrome from layout calculation */
          header, aside, nav, footer,
          [data-print-hide="true"],
          .print\\:hidden,
          .print\\:\\!hidden {
            display: none !important;
            visibility: hidden !important;
            position: absolute !important;
            left: -99999px !important;
            top: -99999px !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        }
      `}</style>

      {/* ── TOP HEADER (Hidden when printing) ───────────────────────────────── */}
      <div data-print-hide="true" className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
                CONFIDENTIAL LEGAL DESK
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                10 Legal Templates · DeepSeek-V3 · Support Email Ready
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              Formal Legal Letters &amp; Disbursement Instruments
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Issue genuine attorney letterhead documents, escrow disbursement receipts, banking wire directions, and compliance clearance certificates for any user or counterparty.
            </p>
          </div>

          {/* Global Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
              title="Print or export isolated document as PDF (Zero UI chrome)"
            >
              <Printer size={15} className="text-emerald-400" />
              <span>Print / Save PDF</span>
            </button>

            {/* Transfer to Support Inbox Button */}
            <button
              onClick={handleTransferToSupportInbox}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
              title="Stage this document as an un-sent email attachment in Support Inbox"
            >
              <Paperclip size={15} />
              <span>Transfer to Support Inbox</span>
            </button>

            {/* Send via Support Email Button */}
            <button
              onClick={handleOpenEmailModal}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95"
              title="Send directly to counterparty via support@remaprofitmachine.com"
            >
              <Mail size={15} />
              <span>Send via Support Email</span>
            </button>

            {/* Attach to Dossier / Undo Detach */}
            {attached ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-xl p-1 shadow-2xs">
                <span className="px-2.5 py-1 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Attached to Dossier</span>
                </span>
                <button
                  type="button"
                  onClick={handleUndoAttachToUser}
                  className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                  title="Undo dossier attachment and remove from user records"
                >
                  <RotateCcw size={12} />
                  <span>Undo / Detach</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAttachToUser}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition active:scale-95"
                title="Attach to user's administrative dossier without sending any email"
              >
                <Paperclip size={15} className="text-slate-500" />
                <span>Attach to Dossier (No Email)</span>
              </button>
            )}

            {/* Undo Last Edit Button (restores previous state from historyStack) */}
            {historyStack.length > 0 && (
              <button
                onClick={handleUndoLastEdit}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
                title="Undo last template/AI change and restore previous draft"
              >
                <Undo2 size={13} />
                <span>Undo Edit ({historyStack.length})</span>
              </button>
            )}

            {/* Undo Transfer Button (if staged in inbox) */}
            {hasStagedInboxDraft && (
              <button
                onClick={handleUndoTransferToSupportInbox}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
                title="Clear staged draft from Support Inbox compose"
              >
                <X size={13} />
                <span>Clear Staged Draft</span>
              </button>
            )}

            {/* Feature Guide Toggle Button */}
            <button
              onClick={() => setShowFeatureGuide((v) => !v)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
              title="Toggle Admin Feature Guide & Explanation"
            >
              <HelpCircle size={15} className="text-slate-600" />
              <span>{showFeatureGuide ? 'Hide Guide' : 'Feature Guide'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Contextual Helper Banners */}
        <div className="space-y-1.5">
          {attached && (
            <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-700 shrink-0" />
                <span>
                  <strong>Dossier File Active:</strong> This verified instrument is securely archived in <strong>{receipt.recipientName}</strong>&apos;s administrative dossier (Ref: <code className="font-mono text-[11px] bg-emerald-100 px-1 py-0.5 rounded">{dossierRecordId || receipt.receiptNo}</code>). It is available during statement verification and audit reviews.
                </span>
              </div>
              <button
                onClick={handleUndoAttachToUser}
                className="text-[11px] font-bold text-emerald-800 underline hover:text-red-700 transition shrink-0 ml-3"
              >
                Undo / Detach Now
              </button>
            </div>
          )}

          {hasStagedInboxDraft && (
            <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <Paperclip size={14} className="text-indigo-700 shrink-0" />
                <span>
                  <strong>Support Inbox Draft Staged:</strong> This instrument is queued as a pending attachment for <strong>{receipt.recipientName}</strong>. You can navigate to Support Inbox to draft your custom cover note, or clear the staged draft.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  onClick={() => navigate('/admin/inbox')}
                  className="text-[11px] font-bold text-indigo-700 underline hover:text-indigo-900 transition"
                >
                  Open Inbox Compose
                </button>
                <span className="text-indigo-300">·</span>
                <button
                  onClick={handleUndoTransferToSupportInbox}
                  className="text-[11px] font-bold text-red-600 underline hover:text-red-800 transition"
                >
                  Clear Draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Feature Guide Drawer */}
        {showFeatureGuide && (
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg animate-fade-in space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Admin Operations &amp; Feature Reference Guide</h3>
              </div>
              <button
                onClick={() => setShowFeatureGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Paperclip size={14} />
                  <span>Attach to Dossier</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Files this verified legal instrument into the user&apos;s administrative dossier for official statement records and audit clearances. <strong>No email is sent.</strong> You can undo or detach at any time.
                </p>
              </div>

              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                  <Mail size={14} />
                  <span>Transfer to Support Inbox</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Packages the letter as an un-sent attachment in the Support Inbox compose drawer. The recipient address is pre-filled, while leaving subject and body blank so you can personalize the message.
                </p>
              </div>

              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Send size={14} />
                  <span>Send via Support Email</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Dispatches this document directly to the recipient from <span className="font-mono text-emerald-400">support@remaprofitmachine.com</span> using verified Resend transactional mail, logged permanently in Support Inbox.
                </p>
              </div>

              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Printer size={14} />
                  <span>Print / Save PDF (Isolated)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Renders a pure, high-resolution printable copy. All admin sidebars, headers, notification counts, and editing panels are stripped, ensuring a pristine legal instrument output.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Undo Safeguards: Use <strong>Undo Edit</strong> to revert template switches or AI generations. Use <strong>Undo / Detach</strong> to remove dossier filings.</span>
              <button
                onClick={() => setShowFeatureGuide(false)}
                className="text-emerald-400 hover:text-emerald-300 font-bold"
              >
                Close Guide
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── PRIVACY BANNER (Hidden when printing) ──────────────────────────── */}
      <div data-print-hide="true" className="bg-slate-900 rounded-2xl p-4 text-white flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Lock size={16} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Independent Legal Instrument Desk:</strong> This page issues formal legal instruments independently (as private counsel, notary, clearinghouse, or depository agent). Documents can be printed or emailed directly from <span className="font-mono text-emerald-300">support@remaprofitmachine.com</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleRevertToBaseline}
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition border border-slate-700"
            title="Revert current document to original template defaults"
          >
            <RotateCcw size={12} />
            <span>Revert to Baseline</span>
          </button>
          <button
            onClick={() => {
              const tpl = LEGAL_LETTER_TEMPLATES[0];
              pushToHistory(receipt);
              handleApplyTemplate(tpl);
            }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <RotateCcw size={12} />
            <span>Reset Universal Default</span>
          </button>
        </div>
      </div>

      {/* ── MAIN TWO-COLUMN WORKSPACE ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ════ LEFT COLUMN: CONTROL & TEMPLATE PANEL ════════════════════════ */}
        <div data-print-hide="true" className="xl:col-span-5 space-y-4 print:hidden">
          {/* 1. Recipient Selector Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User size={14} className="text-emerald-700" />
                Select Recipient / Beneficiary
              </label>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {loadingUsers ? 'Loading…' : `${users.length} users`}
              </span>
            </div>

            {/* Filter Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Dropdown list */}
            <select
              value={selectedUserId}
              onChange={(e) => handleSelectUser(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800"
            >
              <option value="custom">✏ Custom Recipient (Anyone · Not Affiliated with RPM)</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — Balance: ${new Intl.NumberFormat('en-US').format(u.wallet_balance || 0)}
                </option>
              ))}
            </select>

            {/* Direct Editable Name & Ref */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Beneficiary Name
                </label>
                <input
                  type="text"
                  value={receipt.recipientName}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('recipientName', val);
                    updateField('schedulePayee', val);
                  }}
                  placeholder="e.g. John Doe, Esq."
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 text-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Account / Legal Ref
                </label>
                <input
                  type="text"
                  value={receipt.recipientRef}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('recipientRef', val);
                    updateField('scheduleAccountRef', val);
                  }}
                  placeholder="e.g. REF-2026-99201"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono text-slate-800"
                />
              </div>
            </div>

            {selectedUserId === 'custom' && (
              <div className="pt-1 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Recipient Email (Mail Directly to Anyone)
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="e.g. recipient@gmail.com, counsel@lawfirm.com"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 text-slate-900 font-medium placeholder-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Mail to any external client, bank, or counterparty worldwide.
                </p>
              </div>
            )}
          </div>

          {/* 1.5 Statement Prerequisite & Requisition Workflow Card */}
          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText size={15} className="text-amber-800" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Statement Prerequisite Workflow
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono">
                Pre-Payout Condition
              </span>
            </div>

            <p className="text-[11.5px] text-amber-900 leading-relaxed">
              Does <strong className="text-amber-950 underline decoration-amber-400">{receipt.recipientName || 'Wayne Bobo'}</strong> need to collect and provide their certified Statement of Account before payout disbursement can be released?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleLoadStatementRequisition('universal')}
                className="p-2.5 rounded-xl text-left bg-white hover:bg-slate-50 border border-amber-300 text-slate-800 transition shadow-2xs hover:shadow-xs group"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-0.5">
                  <span>Demand Statement (Universal)</span>
                  <Scale size={12} className="text-slate-500 group-hover:text-slate-900" />
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Independent Counsel Escrow Hold notice requiring certified statement before wire.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleLoadStatementRequisition('rpm')}
                className="p-2.5 rounded-xl text-left bg-white hover:bg-emerald-50 border border-emerald-300 text-slate-800 transition shadow-2xs hover:shadow-xs group"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950 mb-0.5">
                  <span>Demand Statement (RPM)</span>
                  <CheckCircle2 size={12} className="text-emerald-600 group-hover:text-emerald-800" />
                </div>
                <p className="text-[10px] text-emerald-700 leading-snug">
                  RPM Corporate Treasury directive mandating 5-page statement verification.
                </p>
              </button>
            </div>

            <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleLoadStatementRequisition('cleared')}
                className="text-[11px] text-emerald-800 font-bold hover:underline flex items-center gap-1"
              >
                <Check size={12} className="text-emerald-600" />
                <span>Statement Verified? Release Payout</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/statements')}
                className="text-[11px] text-indigo-700 font-semibold hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span>Inspect Statement Desk</span>
              </button>
            </div>
          </div>

          {/* 2. Navigation Tabs for Editor Panels */}
          <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setActiveEditorTab('template')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'template'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers size={13} />
              <span>12 Templates</span>
            </button>
            <button
              onClick={() => setActiveEditorTab('ai')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'ai'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>AI Assistant</span>
            </button>
            <button
              onClick={() => setActiveEditorTab('letterhead')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'letterhead'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 size={13} />
              <span>Letterhead</span>
            </button>
            <button
              onClick={() => setActiveEditorTab('content')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'content'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText size={13} />
              <span>Body Text</span>
            </button>
            <button
              onClick={() => setActiveEditorTab('schedule')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'schedule'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Scale size={13} />
              <span>Sign &amp; Ledger</span>
            </button>
            <button
              onClick={() => setActiveEditorTab('seal')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                activeEditorTab === 'seal'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Award size={13} className={showSeal ? 'text-amber-400' : ''} />
              <span>Stamp Seal</span>
            </button>
          </div>

          {/* ── PANEL 1: 12 LEGAL TEMPLATES ─────────────────────────────────── */}
          {activeEditorTab === 'template' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Choose Legal Instrument Template
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Select any legal letter, escrow receipt, or regulatory certificate.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  12 Built-In
                </span>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {LEGAL_LETTER_TEMPLATES.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleApplyTemplate(tpl)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          {tpl.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1 font-medium">
                        {tpl.entityName}
                      </p>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {tpl.documentTitle}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PANEL 2: AI PROMPT (DeepSeek-V3) ────────────────────────────── */}
          {activeEditorTab === 'ai' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-emerald-700" />
                  Describe Any Letter for AI Drafting
                </label>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  DeepSeek-V3 (Paid Active)
                </span>
              </div>

              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your receipt or letter requirements (amount, beneficiary, lawyer, clearinghouse, conditions)..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800 leading-relaxed font-sans"
              />

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Quick AI Prompts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      setPrompt(
                        `Formal legal notice to Wayne Bobo holding $78,958.00 in escrow pending mandatory collection and submission of his certified Statement of Account prior to payment authorization.`
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 bg-amber-100/80 hover:bg-amber-200/80 rounded-lg text-amber-950 transition font-bold border border-amber-300"
                  >
                    Wayne: Demand Statement Before Payout
                  </button>
                  <button
                    onClick={() => {
                      setPrompt(
                        `Disbursement payout receipt to Wayne Bobo of $78,958.00 from independent disbursement lawyer Dean McMahon releasing held escrow funds following verified submission of his certified RPM statement of account.`
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 bg-emerald-100/80 hover:bg-emerald-200/80 rounded-lg text-emerald-950 transition font-bold border border-emerald-300"
                  >
                    Wayne: Release $78,958 (Statement Verified)
                  </button>
                  <button
                    onClick={() => {
                      setPrompt(
                        `Notice of defective statement submission to Wayne Bobo: certified statement was rejected due to missing transaction reconciliation on page 3. Wayne must resubmit certified statement before $78,958.00 wire can disburse.`
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition font-medium"
                  >
                    Wayne: Resubmit Statement (Page 3 Missing)
                  </button>
                  <button
                    onClick={() => {
                      setPrompt(
                        `Certificate of non-encumbrance and compliance clearance from Global Regulatory Review Bureau confirming clean source of funds and unencumbered status for Marlon Dominic Janssen ($10,090,000.00).`
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition font-medium"
                  >
                    Marlon Janssen ($10.09M) AML Clearance
                  </button>
                  <button
                    onClick={() => {
                      setPrompt(
                        `Irrevocable wire direction order from First Continental Settlement Chambers ordering immediate Fedwire delivery of $250,000.00 capital payout to the designated beneficiary account.`
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition font-medium"
                  >
                    Wire Transfer Direction ($250k)
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <SlidersHorizontal size={14} className="text-emerald-400" />
                <span>{isGenerating ? 'Generating with DeepSeek...' : 'Generate with DeepSeek'}</span>
              </button>
            </div>
          )}

          {/* ── PANEL 3: LETTERHEAD & ENTITY CUSTOMIZER ─────────────────────── */}
          {activeEditorTab === 'letterhead' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Letterhead &amp; Issuing Organization
              </h3>

              {/* Visual Design Style Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                  Visual Letterhead &amp; Document Styling
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocumentTheme('independent')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold transition text-left border ${
                      documentTheme === 'independent'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block font-serif text-[12px]">🏛 Independent Legal</span>
                    <span className="text-[9px] opacity-80 font-normal block mt-0.5">Classic Wall St stationery (Non-RPM)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocumentTheme('rpm')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold transition text-left border ${
                      documentTheme === 'rpm'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[12px]">🛡 RPM Portal Desk</span>
                    <span className="text-[9px] opacity-80 font-normal block mt-0.5">Platform portal brand styling</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Organization / Law Firm Name
                </label>
                <input
                  type="text"
                  value={receipt.lawFirmName}
                  onChange={(e) => updateField('lawFirmName', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Subtitle / Division
                </label>
                <input
                  type="text"
                  value={receipt.lawFirmSubtitle}
                  onChange={(e) => updateField('lawFirmSubtitle', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Physical Office Address
                </label>
                <input
                  type="text"
                  value={receipt.lawFirmAddress}
                  onChange={(e) => updateField('lawFirmAddress', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Official Phone
                  </label>
                  <input
                    type="text"
                    value={receipt.lawFirmPhone}
                    onChange={(e) => updateField('lawFirmPhone', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Official Email
                  </label>
                  <input
                    type="text"
                    value={receipt.lawFirmEmail}
                    onChange={(e) => updateField('lawFirmEmail', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Date of Issue
                  </label>
                  <input
                    type="text"
                    value={receipt.dateOfIssue}
                    onChange={(e) => updateField('dateOfIssue', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Document Ref ID
                  </label>
                  <input
                    type="text"
                    value={receipt.receiptNo}
                    onChange={(e) => updateField('receiptNo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── PANEL 4: BODY CONTENT & PARAGRAPHS ──────────────────────────── */}
          {activeEditorTab === 'content' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Subject &amp; Body Paragraphs
              </h3>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Document Title / Subject Line
                </label>
                <input
                  type="text"
                  value={receipt.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Salutation
                </label>
                <input
                  type="text"
                  value={receipt.salutation}
                  onChange={(e) => updateField('salutation', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Recital Paragraphs (Full Text)
                </label>
                {receipt.bodyParagraphs.map((p, i) => (
                  <div key={i} className="relative">
                    <textarea
                      rows={3}
                      value={p}
                      onChange={(e) => {
                        const next = [...receipt.bodyParagraphs];
                        next[i] = e.target.value;
                        updateField('bodyParagraphs', next);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed font-sans"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PANEL 5: SIGNATORY & SCHEDULE LEDGER ────────────────────────── */}
          {activeEditorTab === 'schedule' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Financial Schedule &amp; Attestation
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSchedule}
                    onChange={(e) => setShowSchedule(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Show Schedule Table</span>
                </label>
              </div>

              {showSchedule && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Gross Amount
                      </label>
                      <input
                        type="text"
                        value={receipt.grossAmount}
                        onChange={(e) => updateField('grossAmount', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Net Disbursed
                      </label>
                      <input
                        type="text"
                        value={receipt.netDisbursed}
                        onChange={(e) => updateField('netDisbursed', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Conveyance Reference
                      </label>
                      <input
                        type="text"
                        value={receipt.transactionRef}
                        onChange={(e) => updateField('transactionRef', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Delivery Status
                      </label>
                      <input
                        type="text"
                        value={receipt.deliveryStatus}
                        onChange={(e) => updateField('deliveryStatus', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Signatory credentials */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Attesting Official / Signatory
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                      Signatory Name
                    </label>
                    <input
                      type="text"
                      value={receipt.signatoryName}
                      onChange={(e) => updateField('signatoryName', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                      Signatory Title
                    </label>
                    <input
                      type="text"
                      value={receipt.signatoryTitle}
                      onChange={(e) => updateField('signatoryTitle', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Bar / Registration / Authority Reference
                  </label>
                  <input
                    type="text"
                    value={receipt.barLicenseNo || ''}
                    onChange={(e) => updateField('barLicenseNo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Formal Attestation Clause
                  </label>
                  <textarea
                    rows={2}
                    value={receipt.closingNote}
                    onChange={(e) => updateField('closingNote', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed font-sans"
                  />
                </div>

                {/* Stamp Seal Quick Control in Sign & Ledger */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Authentic Stamp Seal
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {showSeal ? `Affixed: ${SEAL_DEFINITIONS.find((s) => s.id === selectedSealId)?.name || 'Custom Seal'}` : 'Stamp seal currently hidden'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        pushToHistory(receipt);
                        setShowSeal(!showSeal);
                      }}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                        showSeal ? 'bg-amber-100 border-amber-300 text-amber-950' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {showSeal ? 'Affixed (ON)' : 'Hidden (OFF)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('seal')}
                      className="text-[11px] text-indigo-700 font-bold hover:underline"
                    >
                      Customize Seal →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PANEL 6: AUTHENTIC STAMP SEALS ───────────────────────────────── */}
          {activeEditorTab === 'seal' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Award size={14} className="text-amber-600" />
                    <span>Authentic Legal &amp; Corporate Stamp Seals</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Affix an authentic rubber ink stamp or embossed medallion seal to the document.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  8 Authentic Seals
                </span>
              </div>

              {/* Master Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-900 block text-xs">
                    Affix Stamp Seal to Document
                  </label>
                  <p className="text-[10px] text-slate-500">
                    When enabled, the vector seal imprints directly onto the attestation block.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    pushToHistory(receipt);
                    setShowSeal(!showSeal);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showSeal ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      showSeal ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {showSeal && (
                <>
                  {/* Category Filter Tabs */}
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSealCategoryFilter('all')}
                      className={`flex-1 py-1 rounded-md transition ${
                        sealCategoryFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Seals (8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSealCategoryFilter('universal')}
                      className={`flex-1 py-1 rounded-md transition ${
                        sealCategoryFilter === 'universal'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Universal / Non-RPM (4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSealCategoryFilter('rpm')}
                      className={`flex-1 py-1 rounded-md transition ${
                        sealCategoryFilter === 'rpm'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      RPM Platform (4)
                    </button>
                  </div>

                  {/* Seal Cards Grid */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {SEAL_DEFINITIONS.filter((s) => {
                      if (sealCategoryFilter === 'universal') return s.theme === 'universal' || s.theme === 'both';
                      if (sealCategoryFilter === 'rpm') return s.theme === 'rpm' || s.theme === 'both';
                      return true;
                    }).map((seal) => {
                      const isSelected = selectedSealId === seal.id;
                      return (
                        <div
                          key={seal.id}
                          onClick={() => {
                            pushToHistory(receipt);
                            setSelectedSealId(seal.id);
                            toast.success(`Affixed ${seal.name}`);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {/* Mini Preview */}
                          <div className="w-14 h-14 shrink-0 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                            <LegalStampSeal
                              sealId={seal.id}
                              docketNo={receipt.receiptNo}
                              date={receipt.dateOfIssue}
                              tilt="upright"
                              size={52}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {seal.name}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                {seal.badgeText}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">
                              {seal.description}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tilt Angle Controls */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                      Stamping Angle &amp; Realism
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSealTilt('tilted')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition text-center ${
                          sealTilt === 'tilted'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Hand-Stamped (-5°)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSealTilt('upright')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition text-center ${
                          sealTilt === 'upright'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Upright (0°)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSealTilt('angled-right')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition text-center ${
                          sealTilt === 'angled-right'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Hand-Stamped (+5°)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      A slight tilt reproduces the authentic appearance of a physical hand-inked notary or corporate seal.
                    </p>
                  </div>
                </>
              )}

              {/* Verification Note */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-[10px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Info size={12} className="text-amber-700" />
                  <span>Vector SVG Attestation</span>
                </div>
                <p className="leading-relaxed">
                  Seals render with pure mathematical vector clarity at 300+ DPI. When printing or exporting to PDF, the seal is preserved with zero pixelation or image blur.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT COLUMN: PRISTINE LEGAL DOCUMENT CANVAS ═══════════════ */}
        <div className="xl:col-span-7 flex flex-col items-center print:block print:w-full print:m-0 min-w-0 w-full overflow-x-auto print:overflow-visible">
          {/* Document Canvas Action Bar (Hidden when printing) */}
          <div data-print-hide="true" className="w-full max-w-[780px] mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                documentTheme === 'independent' ? 'bg-slate-900 text-white' : 'bg-emerald-950 text-emerald-300'
              }`}>
                {documentTheme === 'independent' ? 'Stationery: Independent Counsel Letterhead' : 'Stationery: RPM Official Portal Desk'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono font-medium">
                {receipt.receiptNo}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  pushToHistory(receipt);
                  setShowSeal(!showSeal);
                  toast.success(showSeal ? 'Stamp Seal hidden from document.' : 'Stamp Seal affixed to document.');
                }}
                className={`px-2.5 py-1.5 border rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition active:scale-95 ${
                  showSeal
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                }`}
                title="Toggle authentic legal stamp seal"
              >
                <Award size={12} className={showSeal ? 'text-amber-700' : 'text-slate-400'} />
                <span>Seal: {showSeal ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyHtml}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition active:scale-95"
                title="Copy responsive HTML email markup"
              >
                <Copy size={12} />
                <span>Copy HTML</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition active:scale-95"
                title="Download as standalone .html file"
              >
                <Download size={12} />
                <span>Download .html</span>
              </button>

              <button
                type="button"
                onClick={handleRevertToBaseline}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition active:scale-95"
                title="Revert manual modifications to template baseline"
              >
                <RotateCcw size={12} />
                <span>Revert Baseline</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs transition active:scale-95"
                title="Print or Save as PDF"
              >
                <Printer size={12} className="text-emerald-400" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Letter Container: Authentic Legal Sheet styling, Fixed Width, Elegant Borders */}
          <div
            ref={printAreaRef}
            id="admin-receipt-printable"
            className={`w-full max-w-[780px] bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:border-none print:max-w-none print:rounded-none print:p-0 ${
              documentTheme === 'independent' ? 'border border-slate-300' : 'border border-slate-200'
            }`}
          >
            {documentTheme === 'independent' ? (
              /* ── THEME 1: AUTHENTIC INDEPENDENT LEGAL STATIONERY (NON-RPM) ── */
              <div className="bg-white">
                {/* Top Engraved Law Office Letterhead */}
                <div className="bg-white px-6 sm:px-10 md:px-14 pt-8 pb-5 text-slate-900 border-b border-slate-200">
                  <div className="text-center space-y-1.5">
                    {/* Classical Scales Emblem */}
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <div className="h-px w-12 sm:w-16 bg-slate-300" />
                      <div className="p-1.5 rounded-full border border-slate-300 bg-slate-50 text-slate-800 shadow-2xs">
                        <Scale size={20} className="stroke-[1.75]" />
                      </div>
                      <div className="h-px w-12 sm:w-16 bg-slate-300" />
                    </div>

                    <h2 className="font-serif font-bold text-xl sm:text-2xl md:text-3xl tracking-widest uppercase text-slate-950">
                      {receipt.lawFirmName}
                    </h2>
                    <p className="font-serif italic text-xs sm:text-sm text-slate-600 tracking-wide max-w-xl mx-auto">
                      {receipt.lawFirmSubtitle}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] sm:text-[10.5px] font-serif uppercase tracking-widest text-slate-500">
                      <span>{receipt.lawFirmAddress}</span>
                      <span className="hidden sm:inline">·</span>
                      <span>{receipt.lawFirmPhone}</span>
                      <span className="hidden sm:inline">·</span>
                      <span>{receipt.lawFirmEmail}</span>
                    </div>
                  </div>

                  {/* Authentic Engraved Double Hairline Rule */}
                  <div className="mt-5 border-t-2 border-b border-slate-900 py-0.5" />
                </div>

                {/* Independent Sheet Body */}
                <div className="px-6 sm:px-10 md:px-14 py-6 sm:py-8 space-y-6 text-[12.5px] leading-relaxed text-slate-800 font-serif">
                  {/* Formal Docket & Filing Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-slate-200 text-xs">
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                        DATE OF EXECUTION
                      </p>
                      <p className="font-semibold text-slate-900">{receipt.dateOfIssue}</p>
                    </div>
                    <div className="sm:text-center">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                        DOCKET / RECORDING NO.
                      </p>
                      <p className="font-mono font-bold text-slate-900">{receipt.receiptNo}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                        CLASSIFICATION
                      </p>
                      <p className="font-semibold text-slate-700 uppercase text-[11px]">
                        PRIVILEGED &amp; SWORN
                      </p>
                    </div>
                  </div>

                  {/* Addressee / Beneficiary Block */}
                  <div className="space-y-1 pt-1 pb-1">
                    <p className="text-[10px] uppercase font-bold tracking-[0.16em] text-slate-500 font-sans">
                      TO THE DESIGNATED BENEFICIARY &amp; HOLDER OF RECORD:
                    </p>
                    <p className="font-serif font-bold text-slate-950 text-base sm:text-lg">
                      {receipt.recipientName}
                    </p>
                    <p className="text-[11.5px] text-slate-600 font-mono">
                      Docket File Reference: <span className="font-semibold text-slate-800">{receipt.recipientRef}</span>
                    </p>
                  </div>

                  {/* Formal Legal Caption Box */}
                  <div className="my-4 py-2.5 px-4 bg-slate-50/80 border-y border-slate-300 text-center">
                    <p className="text-[9px] uppercase tracking-[0.22em] font-bold text-slate-500 font-sans">
                      OFFICIAL LEGAL INSTRUMENT &amp; NOTICE OF CONVEYANCE
                    </p>
                    <h3 className="font-serif font-bold text-sm sm:text-base text-slate-950 uppercase tracking-wide mt-1">
                      IN RE: {receipt.subject}
                    </h3>
                  </div>

                  {/* Salutation */}
                  <p className="font-serif font-semibold text-slate-950">{receipt.salutation}</p>

                  {/* Formal Recitals & Operative Body Text */}
                  <div className="space-y-3.5 text-slate-800 text-justify font-serif text-[12.5px] leading-relaxed indent-6">
                    {receipt.bodyParagraphs.map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>

                  {/* Classical Legal Accounting Schedule Ledger */}
                  {showSchedule && (
                    <div className="border border-slate-300 overflow-hidden shadow-2xs">
                      <div className="bg-slate-100 border-b-2 border-slate-900 px-4 py-2.5 flex items-center justify-between">
                        <span className="font-serif text-[11px] font-bold uppercase tracking-wider text-slate-900">
                          SCHEDULE OF SETTLEMENT &amp; DISBURSEMENT LEDGER
                        </span>
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider bg-white border border-slate-300 text-slate-800 px-2 py-0.5">
                          {receipt.deliveryStatus}
                        </span>
                      </div>
                      <div className="p-4 bg-white divide-y divide-slate-200 text-[11.5px] font-serif">
                        <div className="flex justify-between py-2">
                          <span className="text-slate-600">Designated Beneficiary</span>
                          <span className="font-bold text-slate-900">{receipt.schedulePayee}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-600">Account Reference</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {receipt.scheduleAccountRef}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-600">{scheduleLabels.grossLabel}</span>
                          <span className="font-bold text-slate-900">{receipt.grossAmount} USD</span>
                        </div>
                        <div className="flex justify-between py-2 bg-slate-50/50 px-2 -mx-2">
                          <span className="font-bold text-slate-800">{scheduleLabels.netLabel}</span>
                          <span className="font-bold text-slate-950 text-sm font-mono">
                            {receipt.netDisbursed} USD
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-600">Effective Date of Execution</span>
                          <span className="font-semibold text-slate-800">{receipt.effectiveDate}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-600">{scheduleLabels.refLabel}</span>
                          <span className="font-mono text-slate-700">{receipt.transactionRef}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attestation Note */}
                  <div className="border-l-2 border-slate-900 pl-4 py-2 italic font-serif text-[11.5px] text-slate-700 leading-relaxed bg-slate-50/40">
                    <p>{receipt.closingNote}</p>
                  </div>

                  {/* Sign-Off & Notarial Jurat Seal Block */}
                  {(() => {
                    const { cursiveSignature, displayName, displayTitle } = getCleanSignatoryDetails(
                      receipt.signatoryName,
                      receipt.signatoryTitle
                    );
                    return (
                      <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-200">
                        <div className="space-y-2 shrink-0 max-w-full sm:max-w-[46%]">
                          <p className="font-serif font-medium text-slate-800">{receipt.signoff}</p>
                          <div className="space-y-1">
                            {/* Cursive style representation */}
                            <div className="font-serif italic text-2xl text-slate-950 tracking-wider py-1 select-none">
                              {cursiveSignature}
                            </div>
                            <div className="h-0.5 w-44 sm:w-52 max-w-full bg-slate-900" />
                            <p className="font-serif font-bold text-slate-950 text-xs sm:text-sm">{displayName}</p>
                            <p className="text-[11px] font-serif text-slate-600">{displayTitle}</p>
                            <p className="text-[10px] font-mono text-slate-500">{receipt.barLicenseNo || receipt.lawFirmName}</p>
                          </div>
                        </div>

                        {/* Optional Authentic Visual Stamp Seal */}
                        {showSeal && (
                          <div className="shrink-0 self-center sm:self-end flex items-center justify-center -my-2">
                            <LegalStampSeal
                              sealId={selectedSealId}
                              docketNo={receipt.receiptNo}
                              date={receipt.dateOfIssue}
                              tilt={sealTilt}
                              size={144}
                            />
                          </div>
                        )}

                        {/* Classical Notarial Jurat & Official Legal Stamp (Immune to clipping, completely distinct from RPM) */}
                        <div className="shrink-0 self-start sm:self-end border-2 border-double border-slate-900 rounded-lg p-3 sm:p-3.5 bg-slate-50/90 text-left sm:text-right max-w-full select-none shadow-2xs">
                          <div className="flex items-center sm:justify-end gap-1.5 text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-1">
                            <Scale size={13} className="text-slate-900 shrink-0" />
                            <span className="font-serif">NOTARIAL JURAT &amp; SEAL</span>
                          </div>
                          <p className="text-[9.5px] font-mono font-bold text-slate-900 tracking-wider">
                            DOCKET: {receipt.receiptNo}
                          </p>
                          <p className="text-[8px] font-serif text-slate-600 uppercase tracking-wider mt-1 leading-snug">
                            ATTESTED &amp; AFFIXED UNDER LEGAL AUTHORITY<br />
                            INDEPENDENT FIDUCIARY REGISTRY
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Statutory Confidentiality Notice */}
                  <div className="pt-6 border-t border-slate-200 text-[9px] text-slate-500 font-serif text-justify leading-tight italic">
                    <p>{receipt.confidentialityNotice}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* ── THEME 2: RPM PLATFORM PORTAL DESK ── */
              <div>
                {/* Top Formal Legal Letterhead Band */}
                <div className="bg-slate-950 px-4 sm:px-8 md:px-12 py-6 text-white border-b-2 border-emerald-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Scale size={20} className="text-emerald-400 shrink-0" />
                        <h2 className="font-extrabold text-lg sm:text-xl tracking-tight leading-snug">
                          {receipt.lawFirmName}
                        </h2>
                      </div>
                      <p className="text-slate-300 text-xs font-medium tracking-wide">
                        {receipt.lawFirmSubtitle}
                      </p>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 font-mono shrink-0 hidden sm:block">
                      <p className="text-emerald-400 font-bold uppercase tracking-wider">OFFICIAL LEGAL INSTRUMENT</p>
                      <p>REGISTERED ATTESTATION</p>
                    </div>
                  </div>

                  {/* Sub-bar with contact & jurisdiction */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>{receipt.lawFirmAddress}</span>
                    <div className="flex items-center gap-3">
                      <span>{receipt.lawFirmPhone}</span>
                      <span>·</span>
                      <span>{receipt.lawFirmEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Document Content Sheet */}
                <div className="px-4 sm:px-8 md:px-12 py-6 sm:py-8 space-y-6 text-[12px] leading-relaxed text-slate-800">
                  {/* Meta References Bar */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Date of Issue / Execution
                      </p>
                      <p className="font-semibold text-slate-900 text-xs">{receipt.dateOfIssue}</p>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Instrument Reference:
                        </span>
                        <span className="font-mono font-extrabold text-slate-900 text-xs bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                          {receipt.receiptNo}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Status: Verified Lawful Instrument
                      </p>
                    </div>
                  </div>

                  {/* Recipient / Beneficiary Card */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-0.5">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Designated Beneficiary &amp; Recipient
                    </p>
                    <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {receipt.recipientName}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Account Reference ID: <span className="font-semibold text-slate-700">{receipt.recipientRef}</span>
                    </p>
                  </div>

                  {/* Document Subject Header */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800">
                      Legal Matter &amp; Formal Declaration
                    </p>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50/50">
                      {receipt.subject}
                    </h3>
                  </div>

                  {/* Salutation */}
                  <p className="font-semibold text-slate-900">{receipt.salutation}</p>

                  {/* Formal Recitals & Operative Body Text */}
                  <div className="space-y-3.5 text-slate-700 text-justify font-normal leading-relaxed">
                    {receipt.bodyParagraphs.map((para, idx) => (
                      <p key={idx} className="leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* Optional Execution / Financial Schedule Table */}
                  {showSchedule && (
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white">
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          Execution Schedule &amp; Settlement Ledger
                        </span>
                        <span className="text-emerald-400 text-[10px] font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          {receipt.deliveryStatus}
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50/70 divide-y divide-slate-200 text-[11px]">
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Beneficiary</span>
                          <span className="font-bold text-slate-900">{receipt.schedulePayee}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Account Reference</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {receipt.scheduleAccountRef}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">{scheduleLabels.grossLabel}</span>
                          <span className="font-bold text-slate-900">{receipt.grossAmount} USD</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">{scheduleLabels.netLabel}</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {receipt.netDisbursed} USD
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Effective Execution Date</span>
                          <span className="font-semibold text-slate-800">{receipt.effectiveDate}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">{scheduleLabels.refLabel}</span>
                          <span className="font-mono text-slate-700">{receipt.transactionRef}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Legal Attestation Note */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-800 leading-relaxed font-serif italic">
                    <p>{receipt.closingNote}</p>
                  </div>

                  {/* Authentic Sign-Off & Formal Attestation Block */}
                  {(() => {
                    const { cursiveSignature, displayName, displayTitle } = getCleanSignatoryDetails(
                      receipt.signatoryName,
                      receipt.signatoryTitle
                    );
                    return (
                      <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-200">
                        <div className="space-y-2 shrink-0 max-w-full sm:max-w-[46%]">
                          <p className="font-medium text-slate-800">{receipt.signoff}</p>
                          <div className="space-y-1">
                            {/* Cursive style representation */}
                            <div className="font-serif italic text-2xl text-slate-900 tracking-wider py-1 select-none">
                              {cursiveSignature}
                            </div>
                            <div className="h-0.5 w-40 sm:w-48 max-w-full bg-slate-900" />
                            <p className="font-bold text-slate-900 text-xs">{displayName}</p>
                            <p className="text-[11px] text-slate-600">{displayTitle}</p>
                            <p className="text-[10px] text-slate-400">{receipt.barLicenseNo || receipt.lawFirmName}</p>
                          </div>
                        </div>

                        {/* Optional Authentic RPM Corporate Stamp Seal */}
                        {showSeal && (
                          <div className="shrink-0 self-center sm:self-end flex items-center justify-center -my-2">
                            <LegalStampSeal
                              sealId={selectedSealId}
                              docketNo={receipt.receiptNo}
                              date={receipt.dateOfIssue}
                              tilt={sealTilt}
                              size={144}
                            />
                          </div>
                        )}

                        {/* RPM Compliance & Platform Audit Clearance Seal (Immune to clipping) */}
                        <div className="shrink-0 self-start sm:self-end border border-emerald-300 rounded-xl p-3 sm:p-3.5 bg-emerald-50/70 text-left sm:text-right max-w-full select-none shadow-2xs">
                          <div className="flex items-center sm:justify-end gap-1.5 text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide mb-1">
                            <CheckCircle2 size={13} className="text-emerald-700 shrink-0" />
                            <span>RPM COMPLIANCE CLEARANCE</span>
                          </div>
                          <p className="text-[9.5px] font-mono font-bold text-slate-800 tracking-wider">
                            REG: {receipt.receiptNo}
                          </p>
                          <p className="text-[8px] font-mono text-slate-500 mt-1 leading-snug uppercase">
                            VERIFIED &amp; RECORDED IN RPM PERMANENT ARCHIVE
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Confidentiality Statutory Footer */}
                  <div className="pt-6 border-t border-slate-200 text-[9px] text-slate-400 font-mono text-justify leading-tight">
                    <p>{receipt.confidentialityNotice}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EMAIL DISPATCH MODAL ────────────────────────────────────────────── */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-emerald-400" />
                <span className="text-sm font-bold">
                  Send via Support Email (support@remaprofitmachine.com)
                </span>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  From Mailbox (Verified Support Desk)
                </label>
                <input
                  type="text"
                  disabled
                  value="Legal &amp; Disbursement Desk <support@remaprofitmachine.com>"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="e.g. waynebobosu@gmail.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Cover Note to Recipient
                </label>
                <textarea
                  rows={4}
                  value={emailCoverNote}
                  onChange={(e) => setEmailCoverNote(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-800 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
                <FileText size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  The complete formatted legal document (<strong>{receipt.subject}</strong>) will be securely embedded in full responsive HTML directly beneath this cover note and logged in your Support Inbox thread under <span className="font-mono">support@remaprofitmachine.com</span>.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Delivered via Resend infrastructure.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDispatchEmail}
                  disabled={isSendingEmail}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={13} />
                  <span>{isSendingEmail ? 'Dispatching...' : 'Send Official Email Now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
