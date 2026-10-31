import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Printer,
  Sparkles,
  Paperclip,
  Check,
  RotateCcw,
  FileText,
  User,
  Plus,
  Trash2,
  Lock,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  type PayoutReceiptData,
  getDefaultReceiptData,
  generateReceiptWithGemini,
} from '../../lib/geminiReceiptService';
import { toast } from 'sonner';

interface ProfileOption {
  id: string;
  name: string;
  email: string;
  wallet_balance?: number;
}

export default function AdminReceipts() {
  const [searchParams] = useSearchParams();

  // User directory
  const [users, setUsers] = useState<ProfileOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('custom');

  // Receipt content state
  const [receipt, setReceipt] = useState<PayoutReceiptData>(() =>
    getDefaultReceiptData('Wayne Bobo', 'RPM-ACC-WBOBO-2026', 78958.0)
  );

  // AI & Action state
  const [prompt, setPrompt] = useState(
    'Disbursement payout receipt to Wayne Bobo of $78,958.00 from independent disbursement lawyer Dean McMahon (McMahon & Associates) releasing held escrow funds following verified submission of his certified RPM statement of account.'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [attached, setAttached] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'ai' | 'fields' | 'schedule'>('ai');

  // Printable ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // ── Fetch users directory for recipient picker ──────────────────────────────
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
      if (pUserId) setSelectedUserId(pUserId);
      setPrompt(
        `Disbursement payout receipt to ${name} of $${new Intl.NumberFormat('en-US').format(
          pAmount || 78958.0
        )} from independent disbursement lawyer Dean McMahon releasing held escrow funds after ${name} submitted their verified RPM account statement.`
      );
    }
  }, [searchParams]);

  // Handle user selection from directory
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setAttached(false);

    if (userId === 'custom') return;

    const u = users.find((x) => x.id === userId);
    if (!u) return;

    const cleanName = u.name || u.email.split('@')[0];
    const accRef = `RPM-ACC-${u.id.slice(0, 6).toUpperCase()}-2026`;
    const amt = u.wallet_balance && u.wallet_balance > 0 ? u.wallet_balance : 78958.0;

    const updated = getDefaultReceiptData(cleanName, accRef, amt);
    setReceipt(updated);
    setPrompt(
      `Disbursement payout receipt to ${cleanName} of $${new Intl.NumberFormat('en-US').format(
        amt
      )} from independent disbursement lawyer Dean McMahon releasing held escrow funds after ${cleanName} submitted their verified RPM account statement.`
    );
    toast.info(`Populated receipt with details for ${cleanName}`);
  };

  // Field updater
  const updateField = <K extends keyof PayoutReceiptData>(field: K, val: PayoutReceiptData[K]) => {
    setReceipt((prev) => ({ ...prev, [field]: val }));
    setAttached(false);
  };

  // Paragraph manipulation
  const updateParagraph = (index: number, val: string) => {
    setReceipt((prev) => {
      const copy = [...prev.bodyParagraphs];
      copy[index] = val;
      return { ...prev, bodyParagraphs: copy };
    });
  };

  const addParagraph = () => {
    setReceipt((prev) => ({
      ...prev,
      bodyParagraphs: [...prev.bodyParagraphs, 'Additional legal instruction or terms...'],
    }));
  };

  const removeParagraph = (index: number) => {
    setReceipt((prev) => ({
      ...prev,
      bodyParagraphs: prev.bodyParagraphs.filter((_, i) => i !== index),
    }));
  };

  // AI Generation with gemini-flash-latest
  const handleAIGenerate = async (overridePrompt?: string) => {
    const text = overridePrompt || prompt;
    if (!text.trim()) {
      toast.error('Please enter a description for the receipt.');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateReceiptWithGemini(text, {
        name: receipt.recipientName,
        ref: receipt.recipientRef,
      });
      setReceipt(generated);
      setAttached(false);
      toast.success('Generated official legal receipt with Gemini!');
    } catch (err: any) {
      console.error('[AdminReceipts] Generation error:', err);
      toast.error('Generation failed. Keeping existing receipt fields.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Attach to user dossier (strictly confidential, no emails or notifications sent)
  const handleAttachToUserRecord = () => {
    try {
      const targetId = selectedUserId !== 'custom' ? selectedUserId : receipt.recipientRef || 'general';
      const storageKey = `rpm_receipts_${targetId}`;
      const existingStr = localStorage.getItem(storageKey);
      const existing = existingStr ? JSON.parse(existingStr) : [];

      const record = {
        id: receipt.receiptNo,
        data: receipt,
        issuedAt: new Date().toISOString(),
        recipientName: receipt.recipientName,
        recipientRef: receipt.recipientRef,
        amount: receipt.grossAmount,
        attachedByAdmin: true,
        emailSent: false, // Strict: no email sent to user
      };

      existing.unshift(record);
      localStorage.setItem(storageKey, JSON.stringify(existing));

      // Global log
      const allStr = localStorage.getItem('rpm_all_issued_receipts');
      const all = allStr ? JSON.parse(allStr) : [];
      all.unshift(record);
      localStorage.setItem('rpm_all_issued_receipts', JSON.stringify(all));

      setAttached(true);
      toast.success(
        `Receipt attached to ${receipt.recipientName}'s profile record. (No user emails or notifications sent)`
      );
    } catch (err) {
      console.error('[AdminReceipts] Attach error:', err);
      toast.error('Could not save receipt record locally.');
    }
  };

  // Filtered users for dropdown search
  const filteredUsers = users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* ── Top Page Header (Hidden when printing) ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">
              Confidential Admin Desk
            </span>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              No User Alerts / No Emails
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Legal Disbursement Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Independent Counsel Escrow Disbursement Instrument · Dean McMahon, Esq. (McMahon &amp; Associates)
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            <Printer size={15} />
            <span>Print / Save PDF</span>
          </button>

          <button
            type="button"
            onClick={handleAttachToUserRecord}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition ${
              attached
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold'
            }`}
            title="Attach to user's administrative dossier without sending any email"
          >
            {attached ? <Check size={15} /> : <Paperclip size={15} />}
            <span>{attached ? 'Attached to Dossier' : 'Attach to User (No Email)'}</span>
          </button>
        </div>
      </div>

      {/* ── Security Notice Banner (Hidden when printing) ─────────────────── */}
      <div className="bg-slate-900 text-slate-300 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-xs border border-slate-800 print:hidden">
        <div className="flex items-center gap-2.5">
          <Lock size={16} className="text-emerald-400 shrink-0" />
          <span>
            <strong>Privileged Instrument:</strong> This feature is exclusively visible to administrators. Users cannot view this page or receive emails. When attached, the receipt is saved in the user's permanent file.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setReceipt(getDefaultReceiptData('Wayne Bobo', 'RPM-ACC-WBOBO-2026', 78958.0));
            setSelectedUserId('custom');
            setAttached(false);
            toast.info('Reset to default disbursement template');
          }}
          className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] underline underline-offset-2 shrink-0"
        >
          <RotateCcw size={12} />
          Reset Template
        </button>
      </div>

      {/* ── Two-Column Main Layout: Editor & Canvas (Print hides column 1) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ════ LEFT COLUMN: Controls & Field Customizer ════════════════════ */}
        <div className="lg:col-span-5 space-y-4 print:hidden">

          {/* 1. Recipient Selector Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-brand" /> Select User to Issue Receipt
              </label>
              <span className="text-[11px] text-slate-400">
                {loadingUsers ? 'Loading directory…' : `${users.length} users`}
              </span>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name or email..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand outline-hidden"
                />
              </div>

              <select
                value={selectedUserId}
                onChange={(e) => handleSelectUser(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-hidden"
              >
                <option value="custom">✏ Custom Recipient (Enter details below)</option>
                <optgroup label="Registered Users">
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} — Balance: ${new Intl.NumberFormat('en-US').format(u.wallet_balance || 0)}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Quick beneficiary override inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Beneficiary Name
                  </label>
                  <input
                    type="text"
                    value={receipt.recipientName}
                    onChange={(e) => updateField('recipientName', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Account Ref
                  </label>
                  <input
                    type="text"
                    value={receipt.recipientRef}
                    onChange={(e) => updateField('recipientRef', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Editor Mode Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveEditorTab('ai')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeEditorTab === 'ai'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles size={13} className="text-brand" />
              <span>AI Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveEditorTab('fields')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeEditorTab === 'fields'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText size={13} />
              <span>Letter Content</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveEditorTab('schedule')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeEditorTab === 'schedule'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Schedule &amp; Sign</span>
            </button>
          </div>

          {/* 3A. AI Generator Panel */}
          {activeEditorTab === 'ai' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand" /> Describe Receipt for Gemini
                </span>
                <span className="text-[10px] font-mono text-slate-400">gemini-flash-latest</span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your receipt requirements (amount, beneficiary, lawyer, release condition)..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-hidden leading-relaxed"
              />

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Disbursement payout receipt to Wayne Bobo of $78,958.00 from independent disbursement lawyer Dean McMahon releasing held escrow funds following verified submission of his certified RPM statement of account.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand/10 hover:text-brand border border-slate-200 text-slate-700 font-medium transition"
                  >
                    Wayne Bobo ($78,958) Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Release of settlement proceeds to ${receipt.recipientName} following compliance with the mandatory requirement to obtain and submit a certified RPM Statement of Account.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand/10 hover:text-brand border border-slate-200 text-slate-700 font-medium transition"
                  >
                    Account Statement Escrow Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = `Full capital disbursement receipt from independent legal counsel confirming final payment delivery to ${receipt.recipientName}.`;
                      setPrompt(p);
                      handleAIGenerate(p);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand/10 hover:text-brand border border-slate-200 text-slate-700 font-medium transition"
                  >
                    Capital Payout
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAIGenerate()}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <Sparkles size={14} className={isGenerating ? 'animate-spin' : ''} />
                <span>{isGenerating ? 'Generating with Gemini...' : 'Generate Receipt'}</span>
              </button>
            </div>
          )}

          {/* 3B. Letter Content Fields */}
          {activeEditorTab === 'fields' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 animate-in fade-in duration-150 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={receipt.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Salutation
                </label>
                <input
                  type="text"
                  value={receipt.salutation}
                  onChange={(e) => updateField('salutation', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {/* Paragraphs */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase">
                    Body Paragraphs ({receipt.bodyParagraphs.length})
                  </span>
                  <button
                    type="button"
                    onClick={addParagraph}
                    className="text-brand font-bold text-[11px] flex items-center gap-1 hover:underline"
                  >
                    <Plus size={12} /> Add Paragraph
                  </button>
                </div>

                {receipt.bodyParagraphs.map((para, i) => (
                  <div key={i} className="relative bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Paragraph {i + 1}</span>
                      {receipt.bodyParagraphs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParagraph(i)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-0.5"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      )}
                    </div>
                    <textarea
                      value={para}
                      onChange={(e) => updateParagraph(i, e.target.value)}
                      rows={3}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3C. Schedule & Signatures */}
          {activeEditorTab === 'schedule' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 animate-in fade-in duration-150 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Gross Amount
                  </label>
                  <input
                    type="text"
                    value={receipt.grossAmount}
                    onChange={(e) => updateField('grossAmount', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
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
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    value={receipt.receiptNo}
                    onChange={(e) => updateField('receiptNo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Transaction Ref
                  </label>
                  <input
                    type="text"
                    value={receipt.transactionRef}
                    onChange={(e) => updateField('transactionRef', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Lawyer Name
                  </label>
                  <input
                    type="text"
                    value={receipt.lawyerName}
                    onChange={(e) => updateField('lawyerName', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Law Firm Name
                  </label>
                  <input
                    type="text"
                    value={receipt.lawFirmName}
                    onChange={(e) => updateField('lawFirmName', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Delivery Status Text
                </label>
                <input
                  type="text"
                  value={receipt.deliveryStatus}
                  onChange={(e) => updateField('deliveryStatus', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700"
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
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          )}

        </div>

        {/* ════ RIGHT COLUMN: PRISTINE LEGAL DOCUMENT CANVAS ═══════════════ */}
        <div className="lg:col-span-7 flex justify-center print:block print:w-full print:m-0">

          {/* Letter Container: Fixed Max-Width, No Overlapping, Clean Margins */}
          <div
            ref={printAreaRef}
            className="w-full max-w-[760px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:max-w-none print:rounded-none print:p-0"
          >

            {/* Top Brand Letterhead Stripe */}
            <div className="bg-brand px-8 py-5 flex items-start justify-between gap-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                  <FileText size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base tracking-tight leading-tight">
                    {receipt.lawFirmName}
                  </h2>
                  <p className="text-white/80 text-[11px] font-medium tracking-wide">
                    {receipt.lawFirmSubtitle}
                  </p>
                </div>
              </div>
              <div className="opacity-25 pointer-events-none shrink-0">
                <ShieldCheck size={52} className="text-white" />
              </div>
            </div>

            {/* Counsel Detail Sub-stripe */}
            <div className="bg-slate-900 px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-slate-300 border-b border-slate-800 text-[10px] font-mono">
              <span className="font-semibold text-white">
                {receipt.lawyerName} · {receipt.lawyerTitle}
              </span>
              <span className="text-slate-400">{receipt.lawFirmAddress}</span>
              <div className="flex items-center gap-3 text-slate-400">
                <span>{receipt.lawFirmPhone}</span>
                <span>·</span>
                <span>{receipt.lawFirmEmail}</span>
              </div>
            </div>

            {/* Document Body */}
            <div className="px-8 sm:px-12 py-8 space-y-6 text-[12px] leading-relaxed text-slate-800">

              {/* Date & Receipt Reference Line */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date of Issue</p>
                  <p className="font-semibold text-slate-900 text-xs">{receipt.dateOfIssue}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receipt Ref:</span>
                    <span className="font-mono font-extrabold text-slate-900 text-xs bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                      {receipt.receiptNo}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-mono">Status: Verified Legal Escrow Release</p>
                </div>
              </div>

              {/* Addressee Info Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-0.5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Beneficiary &amp; Recipient
                </p>
                <p className="font-extrabold text-slate-900 text-sm">{receipt.recipientName}</p>
                <p className="text-[11px] font-mono text-slate-500">
                  Account Reference ID: <span className="font-semibold text-slate-700">{receipt.recipientRef}</span>
                </p>
              </div>

              {/* Formal Subject Line */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-brand">
                  Formal Legal Notice &amp; Escrow Confirmation
                </p>
                <h3 className="text-[13px] font-extrabold text-slate-900 leading-snug border-l-4 border-brand pl-3 py-1 bg-brand/5">
                  {receipt.subject}
                </h3>
              </div>

              {/* Salutation */}
              <p className="font-semibold text-slate-900">{receipt.salutation}</p>

              {/* Body Paragraphs */}
              <div className="space-y-3.5 text-slate-700 text-justify">
                {receipt.bodyParagraphs.map((para, idx) => (
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
                    {receipt.deliveryStatus}
                  </span>
                </div>
                <div className="p-4 bg-slate-50/60 divide-y divide-slate-200 text-[11px]">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Designated Beneficiary</span>
                    <span className="font-bold text-slate-900">{receipt.schedulePayee}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Account Reference</span>
                    <span className="font-mono font-semibold text-slate-800">{receipt.scheduleAccountRef}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Gross Settlement Amount</span>
                    <span className="font-bold text-slate-900">{receipt.grossAmount} USD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Net Disbursed &amp; Delivered</span>
                    <span className="font-extrabold text-emerald-600 text-sm">{receipt.netDisbursed} USD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Effective Date</span>
                    <span className="font-semibold text-slate-800">{receipt.effectiveDate}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Legal Conveyance Ref</span>
                    <span className="font-mono text-slate-700">{receipt.transactionRef}</span>
                  </div>
                </div>
              </div>

              {/* Closing Note */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 text-[11px] text-blue-950 leading-relaxed">
                <p>{receipt.closingNote}</p>
              </div>

              {/* Sign-off & Signatures Block */}
              <div className="pt-4 flex items-end justify-between gap-6">
                <div className="space-y-3">
                  <p className="font-medium text-slate-800">{receipt.signoff}</p>
                  <div className="space-y-1">
                    <div className="font-serif italic text-2xl text-slate-800 tracking-wider py-1 select-none">
                      {receipt.signatoryName}
                    </div>
                    <div className="h-0.5 w-48 bg-slate-900" />
                    <p className="font-bold text-slate-900 text-xs">{receipt.signatoryName}</p>
                    <p className="text-[11px] text-slate-500">{receipt.signatoryTitle}</p>
                    <p className="text-[10px] text-slate-400">{receipt.lawFirmName}</p>
                  </div>
                </div>

                {/* Circular Official Seal */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 text-center w-36 shrink-0 bg-slate-50/60 select-none">
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
                <p>{receipt.confidentialityNotice}</p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
