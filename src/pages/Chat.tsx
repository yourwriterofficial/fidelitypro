import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { 
  Send, Check, CheckCheck, Sparkles, 
  HelpCircle, RefreshCw, Bell, BellOff
} from 'lucide-react';
import { toast } from 'sonner';
import { sendEmailAndLog } from '../lib/notify';
import AdminChat from './admin/AdminChat';

interface Message {
  id: string;
  user_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

const SMART_SUGGESTIONS = [
  "How do I make a deposit?",
  "What is the interest rate on staking plans?",
  "How long do withdrawals take to process?",
  "Can I check my property listing investments?"
];

export default function Chat() {
  const { profile } = useAuthStore();

  if (profile?.is_admin) {
    return <AdminChat />;
  }

  const { subscribed, subscribe, unsubscribe } = usePushNotifications(profile?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  
  // Typing broadcast refs
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const fetchMessages = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setLoading(false);
      scrollToBottom();
      
      // Mark read
      await markMessagesAsRead();
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      toast.error('Failed to load chat history');
    }
  };

  const markMessagesAsRead = async () => {
    if (!profile?.id) return;
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('user_id', profile.id)
        .neq('sender_id', profile.id)
        .eq('read', false);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Scroll helper
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Typing event handler
  const handleInputChange = (val: string) => {
    setText(val);
    if (!typingChannelRef.current) return;

    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { typing: true }
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { typing: false }
      });
    }, 2000);
  };

  // Initial fetch and Realtime sub
  useEffect(() => {
    if (!profile?.id) return;
    
    fetchMessages();

    // 1. Subscribe to typing channel
    typingChannelRef.current = supabase.channel(`typing:${profile.id}`);
    typingChannelRef.current.subscribe();

    // 2. Subscribe to messages in this room
    subscriptionRef.current = supabase
      .channel(`chat:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            scrollToBottom();
            
            // If message was sent by admin, mark it read
            if (newMsg.sender_id !== profile.id) {
              markMessagesAsRead();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [profile?.id]);

  const handleSend = async (messageBody: string) => {
    if (!messageBody.trim() || !profile?.id || sending) return;
    setSending(true);
    const textToSend = messageBody.trim();
    try {
      // Clear typing indicator
      if (typingChannelRef.current) {
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { typing: false }
        });
      }

      // 1. Insert message
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          user_id: profile.id,
          sender_id: profile.id,
          body: textToSend,
          read: false
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setMessages(prev => [...prev, newMsg]);
      setText('');
      scrollToBottom();

      // 2. Notify Admins
      // Get all admin IDs
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('is_admin', true);

      const adminIds = (admins || []).map(a => a.id);
      const adminEmails = (admins || []).map(a => a.email).filter(Boolean) as string[];

      if (adminIds.length > 0) {
        // Send Push Alerts
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              user_ids: adminIds,
              title: `Support Message - ${profile.name || 'User'}`,
              body: textToSend,
              url: `/admin/chat?user=${profile.id}`,
              tag: `support-chat-${profile.id}`,
              notification_type: 'info'
            }
          });
        } catch (pushErr) {
          console.warn('Push notify to admins failed:', pushErr);
        }

        // Insert in-app notifications
        try {
          await Promise.all(
            adminIds.map(adminId => 
              supabase.from('notifications').insert({
                user_id: adminId,
                title: 'New Support Message',
                message: `${profile.name || 'User'}: "${textToSend.substring(0, 40)}${textToSend.length > 40 ? '...' : ''}"`,
                type: 'info',
                link: `/admin/chat?user=${profile.id}`,
                read: false
              })
            )
          );
        } catch (notifErr) {
          console.warn('Failed to insert admin notifications:', notifErr);
        }

        // Send Email notifications
        if (adminEmails.length > 0) {
          try {
            await Promise.all(adminEmails.map(email =>
              sendEmailAndLog(
                email,
                `New Support Message from ${profile.name || 'Client'}`,
                `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
                    <h2 style="color: #0f172a;">New Client Message</h2>
                    <p>Client <strong>${profile.name || 'Unknown'}</strong> (${profile.email}) sent a new message:</p>
                    <blockquote style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; font-style: italic;">
                      "${textToSend}"
                    </blockquote>
                    <p style="margin-top: 24px;">
                      <a href="${window.location.origin}/admin/chat?user=${profile.id}" 
                         style="background: #3b82f6; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                         Reply to message
                      </a>
                    </p>
                  </div>
                `
              )
            ));
          } catch (emailErr) {
            console.warn('Email notify to admins failed:', emailErr);
          }
        }
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handlePushToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast.success('Push notifications disabled');
    } else {
      const res = await subscribe();
      if (res.ok) {
        toast.success('Push notifications enabled!');
      } else {
        toast.error(res.error || 'Failed to subscribe');
      }
    }
  };

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-brand" />
        <p className="text-sm text-gray-500 font-medium animate-pulse">Loading secure support inbox...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-160px)] md:h-[calc(100dvh-120px)] mb-16 md:mb-0 bg-white border border-gray-100 shadow-sm rounded-2xl flex overflow-hidden">
      
      {/* Suggestions / Shortcuts (Left panel, hidden on mobile) */}
      <div className="hidden md:flex w-72 border-r border-gray-100 flex-col shrink-0 bg-gray-50/20">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
          <Sparkles size={15} className="text-brand shrink-0 animate-pulse" />
          <h4 className="font-bold text-gray-955 text-xs uppercase tracking-wider">Quick Suggestions</h4>
        </div>
        <div className="p-5 flex-1 overflow-y-auto overscroll-contain space-y-3.5 bg-slate-50/20">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tap to send inquiry:</p>
          {SMART_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="w-full text-left p-3.5 rounded-2xl border border-slate-100 hover:border-brand/25 bg-white text-xs text-slate-700 hover:text-brand font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transform transition-all duration-200 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat (Center panel) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 text-white shrink-0 shadow-md border-b border-indigo-900/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-tr from-brand to-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-brand/35 ring-2 ring-white/10 shrink-0">
              R
            </div>
             <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-wide flex items-center gap-1.5 truncate">
                <span className="truncate">Support Inbox</span>
                <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-0.5 w-3.5 h-3.5 shadow-sm shrink-0" title="Verified Support Account">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </h1>
              <p className="text-[10px] text-emerald-450 font-bold flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 bg-emerald-450 rounded-full animate-ping shrink-0" />
                <span className="truncate">Real-time Support Agent Online</span>
              </p>
            </div>
          </div>

          {/* Push Notification Toggle for iOS/PWA visibility */}
          <button
            onClick={handlePushToggle}
            title={subscribed ? "Push notifications active" : "Enable push notifications"}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 border shrink-0 ${
              subscribed
                ? 'bg-emerald-500/20 text-emerald-350 border-emerald-500/30'
                : 'bg-white/10 text-gray-300 border-white/5 hover:bg-white/15'
            }`}
          >
            {subscribed ? <Bell size={13} className="animate-bounce shrink-0" /> : <BellOff size={13} className="shrink-0" />}
            <span className="hidden sm:inline whitespace-nowrap">{subscribed ? 'Notifications Active' : 'Enable Push Alerts'}</span>
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
          
          {/* Welcome message */}
          <div className="max-w-[85%] mx-auto bg-white rounded-3xl p-5 border border-slate-100 shadow-sm text-center mb-6">
            <div className="w-10 h-10 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <HelpCircle size={20} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">How can we help you today?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Welcome to the Rema Profit Machine support channel. You can message us directly, or tap any of the quick suggestions to initiate a request.
            </p>
          </div>

          {/* Message history */}
          {messages.map((msg, index) => {
            const isMe = msg.sender_id === profile?.id;
            return (
              <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-sm relative group transition-all duration-200 ${
                  isMe 
                    ? 'bg-gradient-to-br from-brand to-indigo-600 text-white rounded-tr-none border border-brand/5 shadow-brand/10' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-100/80 shadow-slate-100'
                }`}>
                  {/* Header/Badge for Support messages */}
                  {!isMe && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-extrabold text-blue-600">Support</span>
                      <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-0.5 w-3 h-3 shadow-xs" title="Verified Support Account">
                        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                  )}
                  {/* Body */}
                  <p className="leading-relaxed break-words font-medium">{msg.body}</p>
                  
                  {/* Meta details (time + read receipts) */}
                  <div className="flex items-center justify-end gap-1.5 mt-1.5">
                    <span className={`text-[9px] font-medium tabular-nums ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                      {formatMessageTime(msg.created_at)}
                    </span>
                    
                    {isMe && (
                      <span className="shrink-0" title={msg.read ? "Read by Admin" : "Delivered"}>
                        {msg.read ? (
                          <CheckCheck size={13} className="text-emerald-300" />
                        ) : (
                          <Check size={13} className="text-white/40" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input controls */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(text); }} 
          className="p-4 bg-white border-t border-slate-100/85 flex gap-3 items-center shrink-0"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type message here..."
            className="flex-1 border border-slate-200/80 rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white outline-none transition-all duration-300 placeholder-slate-400 bg-slate-50/50"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-dark hover:to-indigo-700 disabled:from-slate-250 disabled:to-slate-250 disabled:text-slate-400 text-white rounded-2xl p-3.5 transition-all duration-350 shadow-md hover:shadow-lg shadow-brand/10 hover:shadow-brand/20 shrink-0 flex items-center justify-center transform active:scale-95 disabled:shadow-none"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
      
    </div>
  );
}
