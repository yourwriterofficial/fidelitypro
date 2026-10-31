import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Sparkles,
  Edit3,
  Check,
  RotateCcw,
  Paperclip,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  type PayoutReceiptData,
  getDefaultReceiptData,
  generateReceiptWithGemini,
} from '../../lib/geminiReceiptService';
import { toast } from 'sonner';

interface PayoutReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName?: string;
  recipientRef?: string;
  amount?: number;
  transactionRef?: string;
  date?: string;
  userId?: string;
  userEmail?: string;
  onAttached?: (data: PayoutReceiptData) => void;
}

export const PayoutReceiptModal: React.FC<PayoutReceiptModalProps> = ({
  isOpen,
  onClose,
  recipientName = 'Wayne Bobo',
  recipientRef,
  amount = 78958.0,
  transactionRef,
  userId,
  userEmail,
  onAttached,
}) => {
  // Initialize receipt data with Wayne Bobo / Dean McMahon defaults
  const [data, setData] = useState<PayoutReceiptData>(() =>
    getDefaultReceiptData(recipientName, recipientRef, amount)
  );

  // UI state
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'ai'>('preview');
  const [prompt, setPrompt] = useState(
    `Payout to ${recipientName} of $${new Intl.NumberFormat('en-US').format(
      amount
    )} from independent disbursement lawyer Dean McMahon releasing held escrow funds after ${recipientName} provided his certified RPM account statement.`
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attached, setAttached] = useState(false);

  // Sync initial props if they change
  useEffect(() => {
    if (isOpen) {
      const initial = getDefaultReceiptData(recipientName, recipientRef, amount);
      if (transactionRef) initial.transactionRef = transactionRef;
      setData(initial);
      setPrompt(
        `Payout to ${recipientName} of $${new Intl.NumberFormat('en-US').format(
          amount
        )} from independent disbursement lawyer Dean McMahon releasing held escrow funds after ${recipientName} provided his certified RPM account statement.`
      );
      setAttached(false);
    }
  }, [isOpen, recipientName, recipientRef, amount, transactionRef]);

  if (!isOpen) return null;

  // Handle field update
  const updateField = <K extends keyof PayoutReceiptData>(field: K, val: PayoutReceiptData[K]) => {
    setData((prev) => ({ ...prev, [field]: val }));
  };

  // Handle body paragraph edit
  const updateParagraph = (index: number, val: string) => {
    setData((prev) => {
      const copy = [...prev.bodyParagraphs];
      copy[index] = val;
      return { ...prev, bodyParagraphs: copy };
    });
  };

  const addParagraph = () => {
    setData((prev) => ({
      ...prev,
      bodyParagraphs: [...prev.bodyParagraphs, 'New paragraph content...'],
    }));
  };

  const removeParagraph = (index: number) => {
    setData((prev) => {
      const copy = prev.bodyParagraphs.filter((_, i) => i !== index);
      return { ...prev, bodyParagraphs: copy };
    });
  };

  // Generate with Gemini API
  const handleAIGenerate = async (customPrompt?: string) => {
    const textToUse = customPrompt || prompt;
    if (!textToUse.trim()) {
      toast.error('Please enter a description for the receipt.');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateReceiptWithGemini(textToUse, {
        name: recipientName,
        ref: recipientRef,
        balance: amount,
      });
      setData(generated);
      toast.success('Receipt generated and template populated!');
      setActiveTab('preview');
    } catch (err: any) {
      console.error('[PayoutReceiptModal] AI Error:', err);
      toast.error('Failed to generate with Gemini. Reverting to default template.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    setData(getDefaultReceiptData(recipientName, recipientRef, amount));
    toast.info('Reset to default legal disbursement template.');
  };

  // Attach to user profile without sending any email
  const handleAttachToUserRecord = () => {
    setIsAttaching(true);
    try {
      // Store in localStorage for permanent record keeping per user
      const targetId = userId || recipientRef || 'wayne-bobo';
      const storageKey = `rpm_receipts_${targetId}`;
      const existingStr = localStorage.getItem(storageKey);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      const receiptRecord = {
        id: data.receiptNo,
        data,
        issuedAt: new Date().toISOString(),
        recipientName: data.recipientName,
        recipientRef: data.recipientRef,
        recipientEmail: userEmail,
        amount: data.grossAmount,
        attachedByAdmin: true,
        emailSent: false, // Strict: no email sent to user
      };
      existing.unshift(receiptRecord);
      localStorage.setItem(storageKey, JSON.stringify(existing));

      // Global admin receipt log
      const globalKey = 'rpm_all_issued_receipts';
      const allStr = localStorage.getItem(globalKey);
      const allReceipts = allStr ? JSON.parse(allStr) : [];
      allReceipts.unshift(receiptRecord);
      localStorage.setItem(globalKey, JSON.stringify(allReceipts));

      setAttached(true);
      if (onAttached) onAttached(data);
      toast.success(
        `Receipt attached to ${data.recipientName}'s administrative file. (Confidential: No email sent)`
      );
    } catch (err) {
      console.error('[PayoutReceiptModal] Attach error:', err);
      toast.error('Could not save receipt record locally.');
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity print:hidden"
        onClick={onClose}
      />

      {/* Modal Shell */}
      <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:max-w-none print:m-0 print:p-0">

        {/* ── Top Admin Controls Header Bar (Hidden when printing) ─────────── */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-white/10 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Disbursement Receipt Issuer
                </span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Admin Exclusive · Confidential
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Independent Legal Counsel Payout Receipt · Recipient:{' '}
                <strong className="text-slate-200">{data.recipientName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View/Edit Mode Buttons */}
            <div className="bg-slate-800 p-0.5 rounded-xl border border-white/10 flex items-center">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'preview'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'edit'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 size={13} />
                <span>Edit All Parts</span>
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'ai'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles size={13} />
                <span>AI Prompt</span>
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs"
              title="Print receipt or save to PDF"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>

            {/* Attach to user profile without sending email */}
            <button
              onClick={handleAttachToUserRecord}
              disabled={isAttaching}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                attached
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold'
              }`}
              title="Attach this receipt record to the user's profile without sending any email"
            >
              {attached ? <Check size={13} /> : <Paperclip size={13} />}
              <span>{attached ? 'Attached to User' : 'Attach to User (No Email)'}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Sub-header Banner: Strict Confidentiality Notice ────────────── */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2 text-[11px] text-amber-800 flex items-center justify-between print:hidden">
          <span>
            🔒 <strong>Strict Admin Notice:</strong> Users cannot view this generator. Clicking
            &quot;Attach to User (No Email)&quot; records the PDF internally without sending any
            emails or app alerts.
          </span>
          <button
            onClick={handleReset}
            className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 underline underline-offset-2 ml-3 shrink-0"
          >
            <RotateCcw size={11} /> Reset template
          </button>
        </div>

        {/* ── AI Description Generator Drawer (Visible when activeTab === 'ai') ── */}
        {activeTab === 'ai' && (
          <div className="p-5 bg-slate-50 border-b border-slate-200 print:hidden animate-in fade-in duration-150">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Describe Receipt for Gemini Generation
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Using <code>gemini-flash-latest</code>
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe your receipt requirements (e.g. payout amount, lawyer name, escrow release reason, conditions met)..."
                className="w-full text-xs font-sans p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/30 focus:border-brand outline-hidden shadow-xs leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Payout to Wayne Bobo of $78,958.00 from lawyer Dean McMahon (McMahon & Associates) releasing escrow funds after Wayne Bobo submitted his verified RPM Account Statement.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand text-slate-700 hover:text-brand font-medium transition"
                  >
                    Wayne Bobo ($78,958) Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Official release of settlement proceeds to ${recipientName} following compliance with requirement to submit certified RPM Statement of Account.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand text-slate-700 hover:text-brand font-medium transition"
                  >
                    Escrow Fund Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Capital payout receipt from independent legal counsel confirming delivery of total funds to ${recipientName}.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand text-slate-700 hover:text-brand font-medium transition"
                  >
                    Full Capital Payout
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAIGenerate()}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
                  <span>{isGenerating ? 'Generating with Gemini...' : 'Generate Receipt'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit All Parts Drawer (Visible when activeTab === 'edit') ───────── */}
        {activeTab === 'edit' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 border-b border-slate-200 print:hidden space-y-5">
            <div className="max-w-3xl mx-auto space-y-6 text-xs text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Edit3 size={16} className="text-brand" /> Edit Every Part of the Receipt
                </h3>
                <button
                  onClick={() => setActiveTab('preview')}
                  className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-bold"
                >
                  View Preview →
                </button>
              </div>

              {/* 1. Legal Counsel / Firm Info */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  1. Law Firm &amp; Counsel Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Law Firm Name
                    </label>
                    <input
                      type="text"
                      value={data.lawFirmName}
                      onChange={(e) => updateField('lawFirmName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Firm Subtitle / Specialisation
                    </label>
                    <input
                      type="text"
                      value={data.lawFirmSubtitle}
                      onChange={(e) => updateField('lawFirmSubtitle', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Lawyer Name
                    </label>
                    <input
                      type="text"
                      value={data.lawyerName}
                      onChange={(e) => updateField('lawyerName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Lawyer Title
                    </label>
                    <input
                      type="text"
                      value={data.lawyerTitle}
                      onChange={(e) => updateField('lawyerTitle', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Office Address
                    </label>
                    <input
                      type="text"
                      value={data.lawFirmAddress}
                      onChange={(e) => updateField('lawFirmAddress', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Law Firm Phone
                    </label>
                    <input
                      type="text"
                      value={data.lawFirmPhone}
                      onChange={(e) => updateField('lawFirmPhone', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Law Firm Email
                    </label>
                    <input
                      type="text"
                      value={data.lawFirmEmail}
                      onChange={(e) => updateField('lawFirmEmail', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Recipient & Reference */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  2. Recipient, Dates &amp; Identifiers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Beneficiary / Recipient Name
                    </label>
                    <input
                      type="text"
                      value={data.recipientName}
                      onChange={(e) => updateField('recipientName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Recipient Reference / Account Ref
                    </label>
                    <input
                      type="text"
                      value={data.recipientRef}
                      onChange={(e) => updateField('recipientRef', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Official Receipt Number
                    </label>
                    <input
                      type="text"
                      value={data.receiptNo}
                      onChange={(e) => updateField('receiptNo', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Date of Issue
                    </label>
                    <input
                      type="text"
                      value={data.dateOfIssue}
                      onChange={(e) => updateField('dateOfIssue', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Transaction Reference
                    </label>
                    <input
                      type="text"
                      value={data.transactionRef}
                      onChange={(e) => updateField('transactionRef', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Effective Release Date
                    </label>
                    <input
                      type="text"
                      value={data.effectiveDate}
                      onChange={(e) => updateField('effectiveDate', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Subject & Salutation */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  3. Subject &amp; Salutation
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Formal Subject Line
                  </label>
                  <input
                    type="text"
                    value={data.subject}
                    onChange={(e) => updateField('subject', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Salutation
                  </label>
                  <input
                    type="text"
                    value={data.salutation}
                    onChange={(e) => updateField('salutation', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* 4. Body Paragraphs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                    4. Body Paragraphs ({data.bodyParagraphs.length})
                  </p>
                  <button
                    type="button"
                    onClick={addParagraph}
                    className="text-[11px] text-brand font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus size={12} /> Add Paragraph
                  </button>
                </div>
                <div className="space-y-3">
                  {data.bodyParagraphs.map((para, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Paragraph {idx + 1}</span>
                        {data.bodyParagraphs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParagraph(idx)}
                            className="text-red-500 hover:text-red-700 flex items-center gap-0.5"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                      <textarea
                        value={para}
                        onChange={(e) => updateParagraph(idx, e.target.value)}
                        rows={3}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Financial Matrix */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  5. Financial Disbursement Schedule
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Payee in Schedule
                    </label>
                    <input
                      type="text"
                      value={data.schedulePayee}
                      onChange={(e) => updateField('schedulePayee', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Account Reference in Schedule
                    </label>
                    <input
                      type="text"
                      value={data.scheduleAccountRef}
                      onChange={(e) => updateField('scheduleAccountRef', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Gross Settlement Amount
                    </label>
                    <input
                      type="text"
                      value={data.grossAmount}
                      onChange={(e) => updateField('grossAmount', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Net Disbursed Amount
                    </label>
                    <input
                      type="text"
                      value={data.netDisbursed}
                      onChange={(e) => updateField('netDisbursed', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Delivery Status Badge Text
                    </label>
                    <input
                      type="text"
                      value={data.deliveryStatus}
                      onChange={(e) => updateField('deliveryStatus', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Signatures & Confidentiality */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  6. Sign-off, Closing &amp; Confidentiality
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Sign-off Phrase
                    </label>
                    <input
                      type="text"
                      value={data.signoff}
                      onChange={(e) => updateField('signoff', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Signatory Name
                    </label>
                    <input
                      type="text"
                      value={data.signatoryName}
                      onChange={(e) => updateField('signatoryName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Signatory Full Title
                    </label>
                    <input
                      type="text"
                      value={data.signatoryTitle}
                      onChange={(e) => updateField('signatoryTitle', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Closing Instruction Note
                    </label>
                    <textarea
                      value={data.closingNote}
                      onChange={(e) => updateField('closingNote', e.target.value)}
                      rows={2}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Confidentiality Notice
                    </label>
                    <textarea
                      value={data.confidentialityNotice}
                      onChange={(e) => updateField('confidentialityNotice', e.target.value)}
                      rows={2}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-6 py-2.5 rounded-xl bg-brand text-white text-xs font-bold shadow-md hover:bg-brand/90 transition"
                >
                  Apply &amp; View Legal Document Preview →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRINTABLE LETTER CANVAS ────────────────────────────────────────── */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 text-slate-900 print:bg-white print:p-0 print:overflow-visible">
          {/* Printable Page Container */}
          <div className="max-w-2xl mx-auto border border-slate-200 bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:border-none print:max-w-none print:rounded-none">

            {/* Letterhead Top Stripe */}
            <div className="bg-brand px-6 sm:px-8 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                  <FileText size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-white font-extrabold text-base tracking-tight leading-tight">
                    {data.lawFirmName}
                  </h1>
                  <p className="text-white/80 text-[11px] font-medium tracking-wide">
                    {data.lawFirmSubtitle}
                  </p>
                </div>
              </div>
              {/* Seal watermark */}
              <div className="opacity-25 pointer-events-none shrink-0">
                <ShieldCheck size={54} className="text-white" />
              </div>
            </div>

            {/* Letterhead Detail Bar */}
            <div className="bg-slate-900 px-6 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-800 text-slate-300">
              <span className="text-[10px] font-mono font-medium">
                {data.lawyerName} · {data.lawyerTitle}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {data.lawFirmAddress}
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                <span>{data.lawFirmPhone}</span>
                <span>·</span>
                <span>{data.lawFirmEmail}</span>
              </div>
            </div>

            {/* Document Body Area */}
            <div className="px-6 sm:px-10 py-8 space-y-6 text-[12px] leading-relaxed text-slate-700">

              {/* Date & Receipt Identifiers */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Date of Issue
                  </p>
                  <p className="font-semibold text-slate-900 text-xs">{data.dateOfIssue}</p>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Receipt Ref:
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-xs bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {data.receiptNo}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Security Stamp: <strong className="text-slate-600">CONFIRMED-DELIVERY-EFT</strong>
                  </p>
                </div>
              </div>

              {/* Addressee Info */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-0.5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Beneficiary &amp; Recipient
                </p>
                <p className="font-extrabold text-slate-900 text-sm">{data.recipientName}</p>
                <p className="text-[11px] font-mono text-slate-500">
                  Account Reference ID: <span className="font-semibold text-slate-700">{data.recipientRef}</span>
                </p>
              </div>

              {/* Formal Subject */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-brand">
                  Formal Legal Notice &amp; Escrow Confirmation
                </p>
                <h2 className="text-[13px] font-extrabold text-slate-900 leading-snug border-l-4 border-brand pl-3 py-0.5 bg-brand/5">
                  {data.subject}
                </h2>
              </div>

              {/* Salutation */}
              <p className="font-semibold text-slate-900">{data.salutation}</p>

              {/* Body Paragraphs */}
              <div className="space-y-3.5 text-slate-700 text-justify">
                {data.bodyParagraphs.map((para, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* Financial Matrix Schedule */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-white text-[11px] font-bold uppercase tracking-wider">
                    Disbursement Schedule &amp; Execution Summary
                  </span>
                  <span className="text-emerald-400 text-[10px] font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    {data.deliveryStatus}
                  </span>
                </div>
                <div className="p-4 bg-slate-50/60 divide-y divide-slate-200/80 text-[11px]">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Payee / Designated Beneficiary</span>
                    <span className="font-bold text-slate-900">{data.schedulePayee}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Account Reference</span>
                    <span className="font-mono font-semibold text-slate-800">{data.scheduleAccountRef}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Gross Settlement Amount</span>
                    <span className="font-bold text-slate-900 text-xs">{data.grossAmount} USD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Net Disbursed &amp; Delivered</span>
                    <span className="font-extrabold text-emerald-600 text-sm">{data.netDisbursed} USD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Effective Execution Date</span>
                    <span className="font-semibold text-slate-800">{data.effectiveDate}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Legal Conveyance Ref</span>
                    <span className="font-mono text-slate-700">{data.transactionRef}</span>
                  </div>
                </div>
              </div>

              {/* Closing Note */}
              <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3.5 text-[11px] text-blue-900 leading-relaxed">
                <p>{data.closingNote}</p>
              </div>

              {/* Sign-off & Signatures Block */}
              <div className="pt-4 flex items-end justify-between gap-6">
                <div className="space-y-3">
                  <p className="font-medium text-slate-800">{data.signoff}</p>
                  <div className="space-y-1">
                    {/* Simulated hand signature */}
                    <div className="font-serif italic text-2xl text-slate-800 tracking-wider py-1 select-none">
                      {data.signatoryName}
                    </div>
                    <div className="h-0.5 w-44 bg-slate-900" />
                    <p className="font-bold text-slate-900 text-xs">{data.signatoryName}</p>
                    <p className="text-[11px] text-slate-500">{data.signatoryTitle}</p>
                    <p className="text-[10px] text-slate-400">{data.lawFirmName}</p>
                  </div>
                </div>

                {/* Legal Seal Stamp */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 text-center w-36 shrink-0 bg-slate-50/50 select-none">
                  <div className="w-9 h-9 mx-auto rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center mb-1">
                    <ShieldCheck size={20} className="text-emerald-600" />
                  </div>
                  <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Official Escrow Seal
                  </p>
                  <p className="text-[8px] font-mono text-slate-400">
                    DISBURSEMENT CONFIRMED
                  </p>
                </div>
              </div>

              {/* Confidentiality Footer */}
              <div className="pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-mono text-justify leading-tight">
                <p>{data.confidentialityNotice}</p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
