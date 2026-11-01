import { supabase } from './supabaseClient';
import { notifyUser, notifyAdmins } from './notify';
import { wrapInRpmSiteTemplate } from './rpmEmailTemplate';

export interface EmailMailbox {
  id: string;
  address: string;
  displayName: string;
  type: 'department' | 'personal_staff';
  status: 'active' | 'paused';
}

export interface EmailAttachment {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  mailboxId: string;
  direction: 'inbound' | 'outbound';
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
  createdAt: string;
}

export interface EmailThread {
  id: string;
  mailboxId: string;
  subject: string;
  customerEmail: string;
  customerName: string;
  customerUserId?: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lastMessageAt: string;
  unread: boolean;
  messagesCount: number;
  tags?: string[];
  messages: EmailMessage[];
}

export const SUPPORT_MAILBOXES: EmailMailbox[] = [
  {
    id: 'mb_support',
    address: 'support@remaprofitmachine.com',
    displayName: 'RPM General Support Desk',
    type: 'department',
    status: 'active',
  },
  {
    id: 'mb_legal',
    address: 'legal@remaprofitmachine.com',
    displayName: 'RPM Legal & Disbursement Escrow',
    type: 'department',
    status: 'active',
  },
  {
    id: 'mb_billing',
    address: 'billing@remaprofitmachine.com',
    displayName: 'RPM Treasury & Statement Desk',
    type: 'department',
    status: 'active',
  },
];

const STORAGE_KEY = 'rpm_support_inbox_threads_v3';

// Clean initial threads (no mock emails)
const INITIAL_SEED_THREADS: EmailThread[] = [];

const MOCK_IDENTIFIERS = ['wayne bobo', 'marlon dominic', 'kelly myron', 'waynebobo@'];

export function isMockThread(thread: EmailThread): boolean {
  const name = (thread.customerName || '').toLowerCase();
  const email = (thread.customerEmail || '').toLowerCase();
  return MOCK_IDENTIFIERS.some((mock) => name.includes(mock) || email.includes(mock));
}

export function clearAllInboxThreads(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('rpm_support_inbox_threads_v1');
    localStorage.removeItem('rpm_support_inbox_threads_v2');
  }
}

function loadThreadsFromStorage(): EmailThread[] {
  if (typeof window === 'undefined') return INITIAL_SEED_THREADS;
  try {
    // Purge legacy storage keys with mock data
    localStorage.removeItem('rpm_support_inbox_threads_v1');
    localStorage.removeItem('rpm_support_inbox_threads_v2');

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_THREADS));
      return INITIAL_SEED_THREADS;
    }
    const parsed: EmailThread[] = JSON.parse(raw);
    let cleaned = parsed.filter((t) => !isMockThread(t));
    let hadDuplicates = false;

    // Deduplicate threads by ID
    const seenThreadIds = new Set<string>();
    cleaned = cleaned.filter((t) => {
      if (seenThreadIds.has(t.id)) {
        hadDuplicates = true;
        return false;
      }
      seenThreadIds.add(t.id);
      return true;
    });

    // Deduplicate messages inside each thread
    for (const thread of cleaned) {
      if (!Array.isArray(thread.messages)) continue;
      const seenMsgIds = new Set<string>();
      const dedupedMsgs: EmailMessage[] = [];

      for (const msg of thread.messages) {
        if (!msg) continue;
        if (msg.id && seenMsgIds.has(msg.id)) {
          hadDuplicates = true;
          continue;
        }

        // Deduplicate messages with identical text and sender within 120s
        const isRepeatedContent = dedupedMsgs.some(
          (prev) =>
            prev.fromAddress?.toLowerCase() === msg.fromAddress?.toLowerCase() &&
            (prev.bodyText || '').trim() === (msg.bodyText || '').trim() &&
            Math.abs(new Date(prev.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 120000
        );

        if (isRepeatedContent) {
          hadDuplicates = true;
          continue;
        }

        if (msg.id) seenMsgIds.add(msg.id);
        dedupedMsgs.push(msg);
      }

      if (dedupedMsgs.length !== thread.messages.length) {
        hadDuplicates = true;
        thread.messages = dedupedMsgs;
        thread.messagesCount = dedupedMsgs.length;
        if (dedupedMsgs.length > 0) {
          thread.lastMessageAt = dedupedMsgs[dedupedMsgs.length - 1].createdAt;
        }
      }
    }

    if (hadDuplicates || cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_SEED_THREADS;
  }
}

function saveThreadsToStorage(threads: EmailThread[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch (err) {
    console.error('Failed to save threads to storage', err);
  }
}

/**
 * Fetch all threads matching optional mailbox, queue filter, and search term
 */
export function getInboxThreads(
  mailboxId?: string,
  filterQueue: 'all' | 'open' | 'urgent' | 'pending' | 'resolved' = 'all',
  searchQuery: string = ''
): EmailThread[] {
  let threads = loadThreadsFromStorage();

  if (mailboxId && mailboxId !== 'all') {
    threads = threads.filter((t) => t.mailboxId === mailboxId);
  }

  if (filterQueue === 'open') {
    threads = threads.filter((t) => t.status === 'open');
  } else if (filterQueue === 'urgent') {
    threads = threads.filter((t) => t.priority === 'urgent' && t.status !== 'resolved');
  } else if (filterQueue === 'pending') {
    threads = threads.filter((t) => t.status === 'pending');
  } else if (filterQueue === 'resolved') {
    threads = threads.filter((t) => t.status === 'resolved');
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    threads = threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.customerEmail.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.messages.some((m) => m.bodyText.toLowerCase().includes(q))
    );
  }

  // Sort descending by last message timestamp
  return threads.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

export function getUnreadInboxCount(): number {
  const threads = loadThreadsFromStorage();
  return threads.filter((t) => t.unread && t.status !== 'resolved').length;
}

export function getInboxThreadById(id: string): EmailThread | null {
  const threads = loadThreadsFromStorage();
  return threads.find((t) => t.id === id) || null;
}

export function updateInboxThreadStatus(id: string, status: EmailThread['status']): EmailThread | null {
  const threads = loadThreadsFromStorage();
  const thread = threads.find((t) => t.id === id);
  if (!thread) return null;
  thread.status = status;
  saveThreadsToStorage(threads);
  return thread;
}

export function updateInboxThreadPriority(id: string, priority: EmailThread['priority']): EmailThread | null {
  const threads = loadThreadsFromStorage();
  const thread = threads.find((t) => t.id === id);
  if (!thread) return null;
  thread.priority = priority;
  saveThreadsToStorage(threads);
  return thread;
}

export function markInboxThreadRead(id: string, unread: boolean = false): EmailThread | null {
  const threads = loadThreadsFromStorage();
  const thread = threads.find((t) => t.id === id);
  if (!thread) return null;
  thread.unread = unread;
  saveThreadsToStorage(threads);
  return thread;
}

export function deleteInboxThread(id: string): boolean {
  const threads = loadThreadsFromStorage();
  const filtered = threads.filter((t) => t.id !== id);
  saveThreadsToStorage(filtered);
  return true;
}

/**
 * Dispatch an outbound email from support@remaprofitmachine.com (or designated mailbox)
 * Creates or appends to a thread, delivers via /api/send-email, records in email_logs,
 * and notifies customer in their RPM dashboard.
 */
export async function sendSupportOutboundEmail(params: {
  threadId?: string;
  to: string;
  customerName?: string;
  customerUserId?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  mailboxId?: string;
  priority?: EmailThread['priority'];
  attachments?: EmailAttachment[];
}): Promise<{ success: boolean; threadId: string; error?: string; providerId?: string | null }> {
  const threads = loadThreadsFromStorage();
  const mailbox =
    SUPPORT_MAILBOXES.find((m) => m.id === params.mailboxId) || SUPPORT_MAILBOXES[0];

  const nowIso = new Date().toISOString();
  let thread: EmailThread | undefined;

  if (params.threadId) {
    thread = threads.find((t) => t.id === params.threadId);
  }

  if (!thread) {
    // Create new conversation thread
    const newId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    thread = {
      id: newId,
      mailboxId: mailbox.id,
      subject: params.subject,
      customerEmail: params.to,
      customerName: params.customerName || params.to.split('@')[0],
      customerUserId: params.customerUserId,
      status: 'open',
      priority: params.priority || 'normal',
      lastMessageAt: nowIso,
      unread: false,
      messagesCount: 1,
      tags: ['Support', 'Official Dispatch'],
      messages: [],
    };
    threads.unshift(thread);
  }

  const plainText =
    params.bodyText ||
    params.bodyHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Wrap in official RPM site email template if not already a standalone legal document
  const rawHtml = params.bodyHtml || '';
  const alreadyTemplated =
    rawHtml.includes('<!DOCTYPE') ||
    rawHtml.includes('rpm-legal-letter') ||
    rawHtml.includes('Rema Profit Machine &amp; Portfolio Platform');

  const finalHtml = alreadyTemplated
    ? rawHtml
    : wrapInRpmSiteTemplate({
        recipientName: params.customerName || params.to.split('@')[0],
        subject: params.subject,
        content: rawHtml || plainText,
        mailboxAddress: mailbox.address,
        mailboxDisplayName: mailbox.displayName,
        departmentTag: mailbox.displayName.replace('RPM ', ''),
      });

  const newMessage: EmailMessage = {
    id: `msg_out_${Date.now()}`,
    threadId: thread.id,
    mailboxId: mailbox.id,
    direction: 'outbound',
    fromAddress: mailbox.address,
    fromName: mailbox.displayName,
    toAddresses: [params.to],
    subject: params.subject,
    bodyText: plainText,
    bodyHtml: finalHtml,
    attachments: params.attachments || [],
    createdAt: nowIso,
  };

  thread.messages.push(newMessage);
  thread.messagesCount = thread.messages.length;
  thread.lastMessageAt = nowIso;
  thread.unread = false;
  saveThreadsToStorage(threads);

  // Deliver via serverless proxy /api/send-email
  let providerId: string | null = null;
  let sendError: string | undefined = undefined;

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        from: `${mailbox.displayName} <${mailbox.address}>`,
        replyTo: mailbox.address,
        subject: params.subject,
        html: finalHtml,
        text: plainText,
        attachments: params.attachments,
      }),
    });

    const data = await res.json();
    if (!res.ok && !data.success) {
      sendError = data.error || `HTTP ${res.status}`;
    } else {
      providerId = data.providerId || null;
    }
  } catch (err: any) {
    sendError = err.message || 'Network dispatch error';
  }

  // Also log to Supabase email_logs if possible
  try {
    await supabase.from('email_logs').insert({
      recipient: params.to,
      subject: params.subject,
      body: finalHtml.slice(0, 4000),
    });
  } catch {
    // Non-fatal
  }

  // In-app notification: ONLY for admin or authorized test users (never to real users)
  const isAllowedTestRecipient =
    params.to.toLowerCase() === 'pennysubsofficial@gmail.com' ||
    params.to.toLowerCase().endsWith('@rpmapp.internal') ||
    params.to.toLowerCase().includes('testmail.io');

  if (params.customerUserId && isAllowedTestRecipient) {
    try {
      await notifyUser({
        userId: params.customerUserId,
        title: `Official Email Dispatch: ${params.subject}`,
        message: `An official communication from ${mailbox.address} has been dispatched to your email address (${params.to}).`,
        type: 'info',
        link: '/app/wallet',
      });
    } catch {
      // Non-fatal
    }
  }

  return {
    success: !sendError || sendError.includes('dev preview') || sendError.includes('dev_logged'),
    threadId: thread.id,
    providerId,
    error: sendError,
  };
}

export interface InboundEmailParams {
  from: string;
  fromName?: string;
  to?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  inReplyTo?: string;
  messageId?: string;
  attachments?: EmailAttachment[];
}

/**
 * Ingests an incoming email (reply from customer or new inquiry),
 * matches or creates a thread, updates unread state, and alerts admins.
 */
export async function ingestInboundEmail(params: InboundEmailParams): Promise<{
  success: boolean;
  threadId: string;
  messageId: string;
  error?: string;
}> {
  const threads = loadThreadsFromStorage();
  const nowIso = new Date().toISOString();

  const fromAddress = (params.from || '').toLowerCase().trim();
  const senderName = params.fromName || fromAddress.split('@')[0];
  const rawSubject = (params.subject || 'Support Inquiry').trim();

  // Normalize subject to match parent thread (strip Re:, RE:, Fwd:, FW:, [Admin Forward...])
  const normalizedSubject = rawSubject
    .replace(/^(?:\[Admin Forward[^\]]*\]\s*)+/i, '')
    .replace(/^(?:re|fwd|fw):\s*/i, '')
    .trim()
    .toLowerCase();

  // Search existing thread: match normalized subject or customer email
  let thread = threads.find((t) => {
    const tSub = t.subject
      .replace(/^(?:\[Admin Forward[^\]]*\]\s*)+/i, '')
      .replace(/^(?:re|fwd|fw):\s*/i, '')
      .trim()
      .toLowerCase();
    return tSub === normalizedSubject || (t.customerEmail.toLowerCase() === fromAddress && normalizedSubject.includes(tSub.slice(0, 15)));
  });

  if (!thread) {
    // Also check if any thread has identical customer email as fallback
    thread = threads.find((t) => t.customerEmail.toLowerCase() === fromAddress);
  }

  const messageId = params.messageId || `msg_in_${Date.now()}`;
  let threadId: string;

  const plainText =
    params.bodyText ||
    (params.bodyHtml || '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const fallbackHtml = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${plainText.replace(/\n/g, '<br/>')}</div>`;

  const newMsg: EmailMessage = {
    id: messageId,
    threadId: '',
    mailboxId: params.to?.includes('legal') ? 'mb_legal' : params.to?.includes('billing') ? 'mb_billing' : 'mb_support',
    direction: 'inbound',
    fromAddress: params.from,
    fromName: senderName,
    toAddresses: [params.to || 'support@remaprofitmachine.com'],
    subject: rawSubject,
    bodyText: plainText,
    bodyHtml: params.bodyHtml || fallbackHtml,
    attachments: params.attachments || [],
    createdAt: nowIso,
  };

  if (thread) {
    threadId = thread.id;
    newMsg.threadId = thread.id;

    // Strict duplicate check: prevent re-adding existing message by ID or identical text within 2 minutes
    const alreadyIngested = thread.messages.find(
      (m) =>
        (params.messageId && m.id === params.messageId) ||
        (m.fromAddress?.toLowerCase() === fromAddress &&
          m.bodyText.trim() === plainText.trim() &&
          Math.abs(Date.now() - new Date(m.createdAt).getTime()) < 120000)
    );

    if (alreadyIngested) {
      return {
        success: true,
        threadId: thread.id,
        messageId: alreadyIngested.id,
      };
    }

    thread.messages.push(newMsg);
    thread.messagesCount = thread.messages.length;
    thread.lastMessageAt = nowIso;
    thread.unread = true;
    thread.status = 'open';
  } else {
    threadId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    newMsg.threadId = threadId;
    thread = {
      id: threadId,
      mailboxId: newMsg.mailboxId,
      subject: rawSubject,
      customerEmail: params.from,
      customerName: senderName,
      status: 'open',
      priority: 'normal',
      lastMessageAt: nowIso,
      unread: true,
      messagesCount: 1,
      tags: ['Inbound Inquiry', 'Customer Reply'],
      messages: [newMsg],
    };
    threads.unshift(thread);
  }

  saveThreadsToStorage(threads);

  // Log to Supabase email_logs
  try {
    await supabase.from('email_logs').insert({
      recipient: `Inbox (${thread.customerEmail})`,
      subject: `[INBOUND] ${rawSubject}`,
      body: plainText.slice(0, 3000),
    });
  } catch {
    // non-fatal
  }

  // NOTIFY ADMINS: In-app notification + push alert
  try {
    await notifyAdmins({
      title: `New Email: ${rawSubject}`,
      message: `From ${senderName} (${params.from}): "${plainText.slice(0, 100)}${plainText.length > 100 ? '...' : ''}"`,
      type: 'alert',
      link: '/admin/inbox',
    });
  } catch (notifyErr) {
    console.warn('[ingestInboundEmail] Admin notification error:', notifyErr);
  }

  // Dispatch window event so open inbox updates in real time
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('rpm_inbound_email', {
        detail: {
          threadId,
          from: params.from,
          subject: rawSubject,
          preview: plainText.slice(0, 80),
        },
      })
    );
  }

  return {
    success: true,
    threadId,
    messageId,
  };
}

const PROCESSED_INBOUND_IDS_KEY = 'rpm_processed_inbound_ids_v1';

function getProcessedInboundIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PROCESSED_INBOUND_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveProcessedInboundId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getProcessedInboundIds();
    set.add(id);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(PROCESSED_INBOUND_IDS_KEY, JSON.stringify(arr));
  } catch {
    // Non-fatal
  }
}

/**
 * Polls the local/server proxy to pull real incoming emails from Resend Inbound API,
 * ingests new messages, and triggers live notifications.
 */
export async function syncWithResendInbound(): Promise<{ synced: number; error?: string }> {
  try {
    const res = await fetch('/api/sync-inbound');
    if (!res.ok) {
      return { synced: 0, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.emails)) {
      return { synced: 0, error: data.error };
    }

    const processed = getProcessedInboundIds();
    let newCount = 0;

    // Sort ascending by creation time so replies append in chronological order
    const sorted = [...data.emails].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    for (const email of sorted) {
      const emailId = email.id || email.message_id;
      if (!emailId || processed.has(emailId)) continue;

      // Mark processed immediately to prevent duplicate runs
      processed.add(emailId);
      saveProcessedInboundId(emailId);

      const fromAddress = typeof email.from === 'string' ? email.from : email.from?.email || '';
      const toAddress = Array.isArray(email.to) ? email.to[0] : email.to || 'support@remaprofitmachine.com';

      await ingestInboundEmail({
        from: fromAddress,
        fromName: typeof email.from === 'object' ? email.from.name : undefined,
        to: toAddress,
        subject: email.subject || 'Support Inquiry',
        bodyText: email.text,
        bodyHtml: email.html,
        messageId: emailId,
      });

      newCount++;
    }

    return { synced: newCount };
  } catch (err: any) {
    return { synced: 0, error: err.message };
  }
}
