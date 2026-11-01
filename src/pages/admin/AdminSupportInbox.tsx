import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import {
  Inbox,
  Mail,
  Send,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Paperclip,
  Tag,
  User,
  ArrowLeft,
  ShieldCheck,
  Plus,
  X,
  Bookmark,
  Reply,
  Bell,
} from 'lucide-react';
import {
  type EmailThread,
  type EmailMailbox,
  SUPPORT_MAILBOXES,
  getInboxThreads,
  getInboxThreadById,
  updateInboxThreadStatus,
  markInboxThreadRead,
  deleteInboxThread,
  sendSupportOutboundEmail,
  ingestInboundEmail,
  syncWithResendInbound,
} from '../../lib/supportInboxService';
import QuotedEmailBody from '../../components/inbox/QuotedEmailBody';

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

export default function AdminSupportInbox() {
  const [mailboxes] = useState<EmailMailbox[]>(SUPPORT_MAILBOXES);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('all');
  const [filterQueue, setFilterQueue] = useState<'all' | 'open' | 'urgent' | 'pending' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Registered users for auto-complete in Compose
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  
  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeName, setComposeName] = useState('');
  const [composeUserId, setComposeUserId] = useState('');
  const [composeMailboxId, setComposeMailboxId] = useState('mb_support');
  const [composeSubject, setComposeSubject] = useState('');
  const [composePriority, setComposePriority] = useState<EmailThread['priority']>('normal');
  const [composeBody, setComposeBody] = useState('');
  const [sendingCompose, setSendingCompose] = useState(false);

  // Attached legal document from Admin Receipts / Letters
  const [composeAttachment, setComposeAttachment] = useState<{
    id: string;
    name: string;
    title: string;
    receiptNo: string;
    theme: string;
    recipientName?: string;
    createdAt: string;
    html: string;
  } | null>(null);
  const [previewAttachmentOpen, setPreviewAttachmentOpen] = useState(false);

  // Inbound simulation modal state
  const [simulateReplyOpen, setSimulateReplyOpen] = useState(false);
  const [simulateFrom, setSimulateFrom] = useState('');
  const [simulateFromName, setSimulateFromName] = useState('');
  const [simulateSubject, setSimulateSubject] = useState('');
  const [simulateBody, setSimulateBody] = useState('');
  const [simulating, setSimulating] = useState(false);

  // Play audio chime on new inbound message
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // non-fatal
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with Resend Inbound API (fetches actual customer replies delivered to Resend)
  const handleSyncInbound = async (showToast = false) => {
    setIsSyncing(true);
    try {
      const res = await syncWithResendInbound();
      if (res.synced > 0) {
        refreshThreads();
        playChime();
        toast.success(`Received ${res.synced} new incoming email${res.synced > 1 ? 's' : ''}`);
      } else if (showToast) {
        toast.info('Inbox is already up to date.');
      }
    } catch {
      // Non-fatal
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync on mount and poll every 12 seconds in background
  useEffect(() => {
    handleSyncInbound(false);
    const interval = setInterval(() => {
      handleSyncInbound(false);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Check for transferred receipt/letter draft from Admin Receipts
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rpm_support_inbox_pending_draft');
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.attachment) {
          if (draft.to) setComposeTo(draft.to);
          if (draft.recipientName) setComposeName(draft.recipientName);
          if (draft.recipientUserId) setComposeUserId(draft.recipientUserId);
          setComposeSubject(draft.subject || '');
          setComposeBody('');
          setComposeAttachment(draft.attachment);
          setComposeOpen(true);
          toast.info(
            `Legal instrument "${draft.attachment.title}" attached! Fill in subject & message to send.`,
            { duration: 6000 }
          );
          localStorage.removeItem('rpm_support_inbox_pending_draft');
        }
      }
    } catch (e) {
      console.warn('[AdminSupportInbox] Error reading pending draft:', e);
    }
  }, []);

  // Listen for real-time inbound emails
  useEffect(() => {
    const handleInboundEvent = (e: any) => {
      refreshThreads();
      playChime();
      toast.info(`New email from ${e.detail?.from || 'customer'}: "${e.detail?.subject || 'Inquiry'}"`);
    };
    window.addEventListener('rpm_inbound_email', handleInboundEvent);
    return () => window.removeEventListener('rpm_inbound_email', handleInboundEvent);
  }, []);

  // Load threads
  const refreshThreads = () => {
    const list = getInboxThreads(selectedMailboxId, filterQueue, searchQuery);
    setThreads(list);
    if (!selectedThreadId && list.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSelectedThreadId(list[0].id);
    }
  };

  useEffect(() => {
    refreshThreads();
  }, [selectedMailboxId, filterQueue, searchQuery]);

  // Load users for autocomplete
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, wallet_balance')
        .order('name');
      if (data) {
        setRegisteredUsers(data as RegisteredUser[]);
      }
    };
    loadUsers();
  }, []);

  const activeThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.id === selectedThreadId) || getInboxThreadById(selectedThreadId);
  }, [selectedThreadId, threads]);

  const activeMailbox = useMemo(() => {
    if (!activeThread) return SUPPORT_MAILBOXES[0];
    return SUPPORT_MAILBOXES.find((m) => m.id === activeThread.mailboxId) || SUPPORT_MAILBOXES[0];
  }, [activeThread]);

  const counts = useMemo(() => {
    const all = getInboxThreads(selectedMailboxId, 'all', '');
    return {
      all: all.length,
      open: all.filter((t) => t.status === 'open').length,
      urgent: all.filter((t) => t.priority === 'urgent' && t.status !== 'resolved').length,
      pending: all.filter((t) => t.status === 'pending').length,
      resolved: all.filter((t) => t.status === 'resolved').length,
    };
  }, [selectedMailboxId, threads]);

  // Macro templates
  const CANNED_MACROS = [
    {
      label: 'Statement Verification Approved',
      text: `Dear Customer,\n\nWe have completed the verification of your payment and your official 5-page certified Account Statement is now ready for printing or viewing in your institutional wallet.\n\nThank you for choosing RPM.\n\nRespectfully,\nRPM Support Desk\nsupport@remaprofitmachine.com`,
    },
    {
      label: 'Legal Escrow Receipt Released',
      text: `Dear Beneficiary,\n\nIndependent Disbursement Counsel Dean McMahon has executed and confirmed your official Legal Escrow Disbursement Receipt following receipt of your certified account statement.\n\nYour funds are cleared for irrevocable delivery.\n\nRespectfully,\nRPM Legal & Disbursement Desk\nlegal@remaprofitmachine.com`,
    },
    {
      label: 'Wallet Deposit Credit Confirmed',
      text: `Hello,\n\nYour recent deposit transfer has been verified on-chain and credited to your available institutional liquid balance.\n\nYou may view your updated ledger in your dashboard.\n\nWarm regards,\nRPM Treasury Desk\nbilling@remaprofitmachine.com`,
    },
  ];

  const handleApplyMacro = (macroText: string) => {
    setReplyText((prev) => (prev ? `${prev}\n\n${macroText}` : macroText));
  };

  const handleSendReply = async () => {
    if (!activeThread || !replyText.trim()) return;
    setSendingReply(true);

    try {
      const res = await sendSupportOutboundEmail({
        threadId: activeThread.id,
        to: activeThread.customerEmail,
        customerName: activeThread.customerName,
        customerUserId: activeThread.customerUserId,
        subject: `RE: ${activeThread.subject}`,
        bodyHtml: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${replyText.replace(/\n/g, '<br/>')}</div>`,
        bodyText: replyText,
        mailboxId: activeThread.mailboxId,
        priority: activeThread.priority,
      });

      if (res.success) {
        toast.success(`Reply sent from ${activeMailbox.address}`);
        setReplyText('');
        refreshThreads();
      } else {
        toast.error(`Dispatch warning: ${res.error || 'Failed to deliver'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error dispatching reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendCompose = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error('Please fill recipient email, subject, and message body.');
      return;
    }
    setSendingCompose(true);

    try {
      let finalBodyHtml = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 24px;">${composeBody.replace(/\n/g, '<br/>')}</div>`;

      if (composeAttachment) {
        finalBodyHtml += `
          <div style="margin: 28px 0 20px 0; border-top: 1px dashed #cbd5e1; text-align: center;">
            <span style="background: #ffffff; padding: 0 14px; font-size: 10px; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: bold;">
              Attached Official Legal Instrument · Ref: ${composeAttachment.receiptNo}
            </span>
          </div>
          ${composeAttachment.html}
        `;
      }

      const res = await sendSupportOutboundEmail({
        to: composeTo,
        customerName: composeName || composeTo.split('@')[0],
        customerUserId: composeUserId || undefined,
        subject: composeSubject,
        bodyHtml: finalBodyHtml,
        bodyText: composeBody,
        mailboxId: composeMailboxId,
        priority: composePriority,
        attachments: composeAttachment
          ? [
              {
                name: composeAttachment.name,
                url: '',
                contentType: 'text/html',
              },
            ]
          : undefined,
      });

      if (res.success) {
        toast.success(`Email dispatched to ${composeTo} from support@remaprofitmachine.com`);
        setComposeOpen(false);
        setComposeAttachment(null);
        setComposeTo('');
        setComposeName('');
        setComposeUserId('');
        setComposeSubject('');
        setComposeBody('');
        refreshThreads();
        if (res.threadId) {
          setSelectedThreadId(res.threadId);
        }
      } else {
        toast.error(`Failed to deliver: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error delivering email');
    } finally {
      setSendingCompose(false);
    }
  };

  const handleStatusToggle = (threadId: string, currentStatus: EmailThread['status']) => {
    const nextStatus = currentStatus === 'resolved' ? 'open' : 'resolved';
    updateInboxThreadStatus(threadId, nextStatus);
    toast.success(`Thread marked as ${nextStatus}`);
    refreshThreads();
  };

  const handleDelete = (threadId: string) => {
    deleteInboxThread(threadId);
    toast.success('Thread deleted');
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
    refreshThreads();
  };

  const openSimulateModal = (thread?: EmailThread | null) => {
    const t = thread || activeThread;
    if (t) {
      setSimulateFrom(t.customerEmail);
      setSimulateFromName(t.customerName);
      setSimulateSubject(t.subject.toLowerCase().startsWith('re:') ? t.subject : `Re: ${t.subject}`);
    } else {
      setSimulateFrom('pennysubsofficial@gmail.com');
      setSimulateFromName('Pennysubs Admin');
      setSimulateSubject('Re: Support Inquiry');
    }
    setSimulateBody('');
    setSimulateReplyOpen(true);
  };

  const handleSimulateInboundReply = async () => {
    if (!simulateFrom || !simulateBody.trim()) {
      toast.error('Please specify sender email and message body.');
      return;
    }
    setSimulating(true);

    try {
      const res = await ingestInboundEmail({
        from: simulateFrom,
        fromName: simulateFromName || simulateFrom.split('@')[0],
        subject: simulateSubject || `Re: ${activeThread?.subject || 'Support Inquiry'}`,
        bodyText: simulateBody,
        bodyHtml: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${simulateBody.replace(/\n/g, '<br/>')}</div>`,
      });

      if (res.success) {
        playChime();
        toast.success(`Inbound email received from ${simulateFrom}!`);
        setSimulateReplyOpen(false);
        setSimulateBody('');
        refreshThreads();
        if (res.threadId) {
          setSelectedThreadId(res.threadId);
        }
      } else {
        toast.error(res.error || 'Failed to process inbound email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing email');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="h-[calc(100dvh-170px)] md:h-[calc(100dvh-120px)] bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col overflow-hidden font-sans">
      {/* ── Top Header Toolbar ────────────────────────────────────────────── */}
      <header className="h-auto sm:h-14 py-2.5 sm:py-0 bg-white border-b border-slate-200 px-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-emerald-700/10 text-emerald-800 rounded-lg shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Support Email Desk</h1>
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                support@remaprofitmachine.com
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Dedicated Inbound &amp; Outbound Correspondence Desk with Notification Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <button
            onClick={() => handleSyncInbound(true)}
            disabled={isSyncing}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            title="Refresh & Sync Live Inbound Emails"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => openSimulateModal(null)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition"
            title="Receive or simulate customer email reply"
          >
            <Reply className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Receive Reply</span>
          </button>

          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Compose</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace: 3 Columns on >=2xl, 2 Columns on >=lg, Master-Detail on <lg ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 w-full">
        {/* ── 1. Left Folders & Mailboxes Sidebar (2xl+ displays only: >=1536px) ───────── */}
        <aside className="w-52 bg-white border-r border-slate-200 flex-col shrink-0 p-2.5 select-none hidden 2xl:flex">
          {/* Active Mailbox Dropdown */}
          <div className="mb-3">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
              Mailbox Account
            </label>
            <select
              value={selectedMailboxId}
              onChange={(e) => setSelectedMailboxId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">All Mailboxes (Combined)</option>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </div>

          {/* Queues & Folders Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => setFilterQueue('all')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                filterQueue === 'all'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Inbox className="w-4 h-4 text-emerald-400 shrink-0" /> All Dispatches
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${filterQueue === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setFilterQueue('open')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                filterQueue === 'open'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" /> Open Inquiries
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${filterQueue === 'open' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {counts.open}
              </span>
            </button>

            <button
              onClick={() => setFilterQueue('urgent')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                filterQueue === 'urgent'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" /> Urgent
              </span>
              {counts.urgent > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-bold shrink-0">
                  {counts.urgent}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterQueue('pending')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                filterQueue === 'pending'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 text-blue-500 shrink-0" /> Pending Action
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${filterQueue === 'pending' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {counts.pending}
              </span>
            </button>

            <button
              onClick={() => setFilterQueue('resolved')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                filterQueue === 'resolved'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Resolved
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${filterQueue === 'resolved' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {counts.resolved}
              </span>
            </button>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-100">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Resend API Provider
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                Active Verified Rail
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                Official delivery to clients &amp; admin receipts.
              </p>
            </div>
          </div>
        </aside>

        {/* ── 2. Middle Thread List (Full width on <lg when no thread, 72w-80w on lg+) ── */}
        <section className={`w-full lg:w-72 xl:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden ${activeThread ? 'hidden lg:flex' : 'flex'}`}>
          {/* Mailbox selector for < 2xl screens */}
          <div className="2xl:hidden p-2.5 border-b border-slate-200 bg-slate-50">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
              Mailbox Account
            </label>
            <select
              value={selectedMailboxId}
              onChange={(e) => setSelectedMailboxId(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">All Mailboxes (Combined)</option>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customers, emails, subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>

          {/* Filter Queue Pills (visible on screens below 2xl) */}
          <div className="2xl:hidden flex items-center gap-1 px-2.5 py-2 border-b border-slate-200 bg-slate-50/70 overflow-x-auto no-scrollbar shrink-0">
            {(['all', 'open', 'urgent', 'pending', 'resolved'] as const).map((q) => (
              <button
                key={q}
                onClick={() => setFilterQueue(q)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize shrink-0 transition ${
                  filterQueue === q
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {q} ({counts[q]})
              </button>
            ))}
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Inbox className="w-5 h-5 opacity-40" />
                </div>
                <p className="font-semibold text-slate-600 mb-1">Queue is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[180px]">
                  No messages in this filter. Mock clutter has been purged.
                </p>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                const lastMsg = thread.messages[thread.messages.length - 1];

                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      markInboxThreadRead(thread.id, false);
                    }}
                    className={`p-3 sm:p-3.5 cursor-pointer transition text-left border-l-4 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-600'
                        : thread.unread
                        ? 'bg-amber-50/40 border-amber-500 hover:bg-slate-50'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs truncate ${thread.unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {thread.customerName}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(thread.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div className={`text-xs truncate mb-1 ${thread.unread ? 'font-bold text-slate-900' : 'text-slate-800'}`}>
                      {thread.subject}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {lastMsg?.bodyText || 'No message content.'}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          thread.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : thread.priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {thread.priority.toUpperCase()}
                      </span>

                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          thread.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : thread.status === 'pending'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {thread.status.toUpperCase()}
                      </span>

                      <span className="text-[10px] text-slate-400 ml-auto">
                        {thread.messagesCount} {thread.messagesCount === 1 ? 'msg' : 'msgs'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── 3. Right Conversation View (Takes full width on <lg, flex-1 on lg+) ── */}
        <main className={`flex-1 min-w-0 bg-slate-50 flex flex-col overflow-hidden ${activeThread ? 'flex' : 'hidden lg:flex'}`}>
          {activeThread ? (
            <>
              {/* Thread Top Action Header */}
              <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 shrink-0 lg:hidden flex items-center gap-1.5 text-xs font-bold border border-slate-200 bg-white"
                    title="Back to inquiries list"
                  >
                    <ArrowLeft className="w-4 h-4 text-emerald-700" />
                    <span>Inbox</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs sm:text-base font-bold text-slate-900 truncate" title={activeThread.subject}>
                      {activeThread.subject}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 truncate">
                      <span className="font-semibold text-slate-700 truncate">{activeThread.customerName}</span>
                      <span>·</span>
                      <span className="text-slate-400 truncate">{activeThread.customerEmail}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openSimulateModal(activeThread)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition flex items-center gap-1"
                    title="Receive reply from customer on this thread"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Receive Reply</span>
                  </button>

                  <button
                    onClick={() => handleStatusToggle(activeThread.id, activeThread.status)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      activeThread.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{activeThread.status === 'resolved' ? 'Resolved ✓' : 'Resolve'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(activeThread.id)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Thread"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Chronology */}
              <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-2.5 sm:p-5 space-y-3 sm:space-y-4">
                {activeThread.messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound';

                  return (
                    <div
                      key={msg.id}
                      className={`w-full max-w-3xl rounded-xl sm:rounded-2xl shadow-xs transition overflow-hidden border ${
                        isOutbound
                          ? 'ml-auto border-emerald-200/90 bg-white ring-1 ring-emerald-500/10'
                          : 'mr-auto border-blue-200/90 bg-white ring-1 ring-blue-500/10'
                      }`}
                    >
                      {/* Card Header Bar */}
                      <div
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 text-xs border-b ${
                          isOutbound
                            ? 'bg-slate-900 text-white border-slate-800'
                            : 'bg-blue-50 text-blue-950 border-blue-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold truncate">
                          {isOutbound ? (
                            <span className="text-emerald-400 flex items-center gap-1.5 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-700/50">
                                STAFF DISPATCH
                              </span>
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              <span className="truncate">{msg.fromName || 'RPM Support'} ({msg.fromAddress})</span>
                            </span>
                          ) : (
                            <span className="text-blue-900 flex items-center gap-1.5 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-blue-100 text-blue-800 font-extrabold border border-blue-200">
                                CUSTOMER INBOUND
                              </span>
                              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{msg.fromName || 'Client'} &lt;{msg.fromAddress}&gt;</span>
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] sm:text-[11px] shrink-0 font-medium ${isOutbound ? 'text-slate-400' : 'text-blue-600'}`}>
                          {new Date(msg.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Message Body Content - Crisp high-contrast readable slate text with collapsed quoted history */}
                      <div className="p-3 sm:p-5 bg-white text-slate-900 overflow-hidden">
                        <QuotedEmailBody
                          html={msg.bodyHtml}
                          text={msg.bodyText}
                        />

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                            {msg.attachments.map((att, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 truncate max-w-full"
                              >
                                <Paperclip className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="truncate">{att.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fast Reply Composer Desk */}
              <div className="p-2.5 sm:p-4 bg-white border-t border-slate-200 shrink-0">
                {/* Macro templates bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 mr-1">
                    <Bookmark className="w-3.5 h-3.5 text-emerald-600" /> Canned:
                  </span>
                  {CANNED_MACROS.map((macro, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplyMacro(macro.text)}
                      className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition font-medium whitespace-nowrap shrink-0"
                    >
                      {macro.label}
                    </button>
                  ))}
                </div>

                <div className="relative mt-1">
                  <textarea
                    rows={2}
                    placeholder={`Reply to ${activeThread.customerName} via ${activeMailbox.address}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-none h-18 sm:h-20"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <span className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                      From <strong className="text-slate-600">{activeMailbox.address}</strong>
                    </span>

                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs shrink-0 ml-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 sm:p-8 text-center text-slate-400">
              <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-3">
                <Mail className="w-7 sm:w-8 h-7 sm:h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {threads.length === 0 ? 'Support Mailbox is Clean' : 'Select a Conversation'}
              </h3>
              <p className="text-xs max-w-sm text-slate-500 mb-5 leading-relaxed">
                {threads.length === 0
                  ? 'No active tickets or mock clutter in this queue. You can compose and dispatch official legal receipts, statements, and notifications at any time.'
                  : 'Choose an inquiry from the list to view customer correspondence, send verified replies, or attach legal receipts.'}
              </p>
              <button
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Compose New Dispatch</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Docked / Modal Compose Window ─────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-400" />
                Compose Official Communication (support@remaprofitmachine.com)
              </span>
              <button
                onClick={() => setComposeOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Mailbox Sender */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">From Mailbox</label>
                <select
                  value={composeMailboxId}
                  onChange={(e) => setComposeMailboxId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                >
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.address})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick User Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Recipient (Choose Registered User or enter email)
                </label>
                <select
                  onChange={(e) => {
                    const u = registeredUsers.find((user) => user.email === e.target.value);
                    if (u) {
                      setComposeTo(u.email);
                      setComposeName(u.name);
                      setComposeUserId(u.id);
                    } else {
                      setComposeTo(e.target.value);
                    }
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 mb-1.5"
                >
                  <option value="">-- Choose registered customer --</option>
                  {registeredUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email}) — Balance: ${Number(u.wallet_balance || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <input
                  type="email"
                  placeholder="Recipient Email Address (e.g. customer@example.com)"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Official Notice / Disbursement Advice / Account Verification..."
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-semibold"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Priority</label>
                <select
                  value={composePriority}
                  onChange={(e) => setComposePriority(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority (Direct Alert)</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              {/* Body */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Message Body</label>
                <textarea
                  rows={6}
                  placeholder="Enter message content..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700 leading-relaxed font-sans"
                />
              </div>

              {/* Attached Legal Document (if transferred from Admin Receipts) */}
              {composeAttachment && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            Attached Legal Instrument
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Ref: {composeAttachment.receiptNo}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                          {composeAttachment.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachmentOpen(true)}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeAttachment(null)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remove attachment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    This document will be automatically embedded and delivered to the recipient alongside your custom message.
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Delivered via Resend and recorded in audit logs.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendCompose}
                  disabled={sendingCompose}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{sendingCompose ? 'Sending...' : 'Dispatch Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Attachment Preview Modal ─────────────────────────────── */}
      {previewAttachmentOpen && composeAttachment && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Attached Instrument Preview: {composeAttachment.title}
                </span>
              </div>
              <button
                onClick={() => setPreviewAttachmentOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div
                className="w-full max-w-[680px] bg-white shadow-md rounded-xl overflow-hidden"
                dangerouslySetInnerHTML={{ __html: composeAttachment.html }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Docked / Modal Receive Inbound Customer Email ────────────────── */}
      {simulateReplyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 bg-blue-950 text-white flex items-center justify-between shrink-0">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Reply className="w-4 h-4 text-blue-300" />
                Receive Inbound Customer Email / Reply
              </span>
              <button
                onClick={() => setSimulateReplyOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-100 flex items-start gap-2">
                <Bell className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-blue-900 text-[11px] leading-relaxed">
                  Ingests an incoming reply from a customer (e.g. Pennysubs replying in Gmail). It routes through the inbound pipeline, appends to the conversation, sets unread status, and alerts administrators.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={simulateFrom}
                  onChange={(e) => setSimulateFrom(e.target.value)}
                  placeholder="customer@gmail.com"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Customer / Sender Name</label>
                <input
                  type="text"
                  value={simulateFromName}
                  onChange={(e) => setSimulateFromName(e.target.value)}
                  placeholder="Pennysubs Admin"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Subject</label>
                <input
                  type="text"
                  value={simulateSubject}
                  onChange={(e) => setSimulateSubject(e.target.value)}
                  placeholder="Re: Official Notice"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Reply Message Content</label>
                <textarea
                  rows={4}
                  value={simulateBody}
                  onChange={(e) => setSimulateBody(e.target.value)}
                  placeholder="Enter the customer reply text here..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400">
                Triggered via Inbound Email Engine
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSimulateReplyOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateInboundReply}
                  disabled={simulating || !simulateBody.trim()}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>{simulating ? 'Injecting...' : 'Inject Inbound Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
