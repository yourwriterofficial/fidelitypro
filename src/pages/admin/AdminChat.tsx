import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';
import { useLocation } from 'react-router-dom';
import { 
  Send, Users, Check, CheckCheck, RefreshCw, 
  Wallet, ShieldAlert, ShieldCheck, Mail, User, Info, ArrowLeft, Plus, X, Trash2, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { sendEmailToUser } from '../../lib/notify';

interface Profile {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
  banned: boolean;
  can_withdraw: boolean;
  can_invest: boolean;
  fee_required: number;
  last_seen?: string;
  assigned_admin_id?: string | null;
}

interface Message {
  id: string;
  user_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface Thread {
  user_id: string;
  user?: Profile;
  lastMessage: Message;
  unreadCount: number;
}

export default function AdminChat() {
  const { profile } = useAuthStore();
  const location = useLocation();
  
  // Threads list and active thread
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [claimFilter, setClaimFilter] = useState<'all' | 'my' | 'unassigned'>('all');
  
  // Input and UI status
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  // New Chat initiation state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // Real-time typing status
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [followedInvestors, setFollowedInvestors] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const threadsChannelRef = useRef<any>(null);
  const messagesChannelRef = useRef<any>(null);

  // Formatting helpers
  const fmtCurrency = (n: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  
  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Never active';
    const date = new Date(dateStr);
    const diffMs = new Date().getTime() - date.getTime();
    if (diffMs <= 0) return 'Just now';
    
    let seconds = Math.floor(diffMs / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
    
    return parts.join(', ') + ' ago';
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userParam = params.get('user');
    if (userParam) {
      setActiveUserId(userParam);
    }
  }, [location.search]);

  const handleClaimToggle = async () => {
    if (!activeUserId || !profile?.id) return;
    const activeUser = threads.find(t => t.user_id === activeUserId)?.user ||
                       allProfiles.find(p => p.id === activeUserId);
    const currentClaim = activeUser?.assigned_admin_id;
    const isClaimedByMe = currentClaim === profile.id;
    const nextClaim = isClaimedByMe ? null : profile.id;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ assigned_admin_id: nextClaim })
        .eq('id', activeUserId);
      if (error) throw error;

      // Update thread state locally
      setThreads(prev => prev.map(t => {
        if (t.user_id === activeUserId) {
          return { ...t, user: t.user ? { ...t.user, assigned_admin_id: nextClaim } : undefined };
        }
        return t;
      }));
      // Update allProfiles state locally
      setAllProfiles(prev => prev.map(p => {
        if (p.id === activeUserId) {
          return { ...p, assigned_admin_id: nextClaim };
        }
        return p;
      }));
      toast.success(nextClaim ? 'Conversation claimed!' : 'Conversation released.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update claim assignment.');
    }
  };

  const handleFollowToggle = async (targetName: string) => {
    if (!profile?.id) return;
    const isFollowing = followedInvestors.includes(targetName.toLowerCase());
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('investor_chat_follows')
          .delete()
          .eq('admin_id', profile.id)
          .eq('target_name', targetName);
        if (error) throw error;
        setFollowedInvestors(prev => prev.filter(name => name !== targetName.toLowerCase()));
        toast.success(`Stopped following @${targetName}`);
      } else {
        const { error } = await supabase
          .from('investor_chat_follows')
          .insert({ admin_id: profile.id, target_name: targetName });
        if (error) throw error;
        setFollowedInvestors(prev => [...prev, targetName.toLowerCase()]);
        toast.success(`Following @${targetName}. You will be notified when they post in Investor Chat.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update follow status');
    }
  };

  const fetchProfilesForNewChat = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, wallet_balance, banned, can_withdraw, can_invest, fee_required, last_seen, assigned_admin_id')
        .eq('is_admin', false);
      if (error) throw error;
      setAllProfiles((data || []) as Profile[]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch user profiles');
    }
  };

  const fetchThreads = async () => {
    try {
      // 1. Fetch unread counts grouped by user_id
      const { data: unreads } = await supabase
        .from('messages')
        .select('user_id')
        .eq('read', false)
        .neq('sender_id', profile?.id); // messages sent by users

      const unreadMap: Record<string, number> = {};
      (unreads || []).forEach(m => {
        unreadMap[m.user_id] = (unreadMap[m.user_id] || 0) + 1;
      });

      // 2. Fetch the latest message for each user thread
      const { data: latestMsgs, error } = await supabase
        .rpc('get_latest_messages_by_user'); // SQL helper function compiled in migration

      if (error) throw error;
      if (!latestMsgs) return;

      // 3. Fetch user profiles for these threads
      const userIds = latestMsgs.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, wallet_balance, banned, can_withdraw, can_invest, fee_required, last_seen, assigned_admin_id')
        .in('id', userIds);

      const profileMap: Record<string, Profile> = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });

      const list: Thread[] = latestMsgs.map((m: any) => ({
        user_id: m.user_id,
        user: profileMap[m.user_id],
        lastMessage: m,
        unreadCount: unreadMap[m.user_id] || 0
      }));

      // Sort by latest message date desc
      list.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
      setThreads(list);
    } catch (err) {
      console.error('Error fetching threads:', err);
      toast.error('Failed to load active support threads');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark as read in DB
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('user_id', userId)
        .neq('sender_id', profile?.id)
        .eq('read', false);

      // Decrement unread local count for this thread
      setThreads(prev => prev.map(t => t.user_id === userId ? { ...t, unreadCount: 0 } : t));
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load chat history');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId === 'temp') return;
    if (!confirm('Are you sure you want to permanently delete this message?')) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      toast.success('Message deleted');
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message');
    }
  };

  // Setup typing listener subscription
  useEffect(() => {
    setIsUserTyping(false);
    if (!activeUserId) return;
    
    const typingChannel = supabase.channel(`typing:${activeUserId}`);
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setIsUserTyping(payload.typing);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [activeUserId]);

  // Initial threads load and global sync subscription
  useEffect(() => {
    if (!profile?.id) return;
    fetchThreads();

    const fetchFollows = async () => {
      const { data } = await supabase
        .from('investor_chat_follows')
        .select('target_name')
        .eq('admin_id', profile.id);
      if (data) {
        setFollowedInvestors(data.map((f: any) => f.target_name.toLowerCase()));
      }
    };
    fetchFollows();

    threadsChannelRef.current = supabase
      .channel('admin_threads_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    // 2. Realtime profiles updates to sync last_seen
    const profilesChannel = supabase
      .channel('admin_profiles_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as Profile;
          setThreads(prev => prev.map(t => t.user_id === updated.id ? { ...t, user: updated } : t));
        }
      )
      .subscribe();

    return () => {
      if (threadsChannelRef.current) {
        supabase.removeChannel(threadsChannelRef.current);
      }
      supabase.removeChannel(profilesChannel);
    };
  }, [profile?.id]);

  // Handle active thread change
  useEffect(() => {
    if (!activeUserId) return;
    fetchMessages(activeUserId);

    // Subscribe to messages in this room
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
    }

    messagesChannelRef.current = supabase
      .channel(`admin_room:${activeUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${activeUserId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            
            // Mark read if it came from the user
            if (newMsg.sender_id !== profile?.id) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMsg.id)
                .then();
            }

            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
      }
    };
  }, [activeUserId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUserId || !replyText.trim() || !profile?.id || sending) return;
    setSending(true);
    const textToSend = replyText.trim();
    try {
      // 1. Insert reply
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          user_id: activeUserId,
          sender_id: profile.id,
          body: textToSend,
          read: false
        })
        .select()
        .single();

      if (error) throw error;
      setReplyText('');
      setMessages(prev => [...prev, newMsg]);
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // 2. Fetch the client profile for notification triggers
      const activeUser = threads.find(t => t.user_id === activeUserId)?.user ||
                         allProfiles.find(p => p.id === activeUserId);

      if (activeUser) {
        // Trigger push notification to user
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              user_ids: [activeUserId],
              title: 'RPM Support Center',
              body: textToSend,
              url: '/app/chat',
              tag: `chat-reply`,
              notification_type: 'info'
            }
          });
        } catch (pushErr) {
          console.warn('Push notify to user failed:', pushErr);
        }

        // Insert in-app notification for user
        try {
          await supabase.from('notifications').insert({
            user_id: activeUserId,
            title: 'New Support Message',
            message: `Support: "${textToSend.substring(0, 40)}${textToSend.length > 40 ? '...' : ''}"`,
            type: 'info',
            link: '/app/chat',
            read: false
          });
        } catch (notifErr) {
          console.warn('Failed to insert user notification:', notifErr);
        }

        // Send email alert to user (respecting preference locks)
        try {
          await sendEmailToUser(
            activeUserId,
            'info',
            'New message from RPM Support',
            `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
                <h2 style="color: #0f172a;">New Message from RPM Support</h2>
                <p>Our support team has sent you a new reply:</p>
                <blockquote style="background: #f8fafc; border-left: 4px solid #0f172a; padding: 12px; margin: 16px 0; font-style: italic;">
                  "${textToSend}"
                </blockquote>
                <p style="margin-top: 24px;">
                  <a href="${window.location.origin}/app/chat" 
                     style="background: #0f172a; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                     Open Support Chat
                  </a>
                </p>
              </div>
            `
          );
        } catch (emailErr) {
          console.warn('Email notify to user failed:', emailErr);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  // Find profile of selected user thread
  const activeThread = threads.find(t => t.user_id === activeUserId);
  const activeUser = activeThread?.user || allProfiles.find(p => p.id === activeUserId);

  // Filter threads by claim status
  const filteredThreads = threads.filter(t => {
    if (claimFilter === 'my') {
      return t.user?.assigned_admin_id === profile?.id;
    }
    if (claimFilter === 'unassigned') {
      return !t.user?.assigned_admin_id;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-brand" />
        <p className="text-sm text-gray-500 font-medium">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-170px)] md:h-[calc(100dvh-120px)] mb-16 md:mb-0 bg-white border border-gray-100 shadow-sm rounded-2xl flex overflow-hidden">
      
      {/* Thread list (Left panel) */}
      <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col shrink-0 ${activeUserId && 'hidden md:flex'}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Users size={16} /> Active Conversations
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setShowNewChatModal(true); fetchProfilesForNewChat(); }}
              className="p-1 hover:bg-gray-100 rounded-lg transition text-brand"
              title="Start conversation"
            >
              <Plus size={16} />
            </button>
            <button onClick={fetchThreads} className="p-1 hover:bg-gray-100 rounded-lg transition text-gray-400">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Claim Assignment filter tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/30 p-1.5 gap-1 shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'my', label: 'Mine' },
            { id: 'unassigned', label: 'Unassigned' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setClaimFilter(tab.id as any)}
              className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition ${
                claimFilter === tab.id
                  ? 'bg-white text-gray-800 shadow-sm border border-gray-150'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-50">
          {filteredThreads.length === 0 ? (
            <div className="py-14 text-center px-4">
              <Users size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">No active support chats</p>
            </div>
          ) : (
            filteredThreads.map(t => {
              const active = t.user_id === activeUserId;
              const name = t.user?.name || 'Unknown User';
              const lastText = t.lastMessage?.body || '';
              return (
                <button
                  key={t.user_id}
                  onClick={() => setActiveUserId(t.user_id)}
                  className={`w-full p-4 flex items-start gap-3 transition text-left border-l-4 ${
                    active 
                      ? 'bg-brand/5 border-brand' 
                      : 'border-transparent hover:bg-gray-50/50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-900/5 text-gray-800 font-extrabold flex items-center justify-center text-xs shrink-0 relative">
                    {name.charAt(0).toUpperCase()}
                    {t.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white animate-pulse">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-semibold text-gray-900 text-xs truncate">{name}</h4>
                      <span className="text-[9px] text-gray-400 font-medium tabular-nums ml-1 shrink-0">
                        {new Date(t.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${t.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                      {lastText}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {t.user?.assigned_admin_id === profile?.id ? (
                        <span className="text-[8px] bg-blue-50 text-blue-650 font-bold border border-blue-200/50 px-1.5 rounded uppercase tracking-wider">
                          Claimed by Me
                        </span>
                      ) : t.user?.assigned_admin_id ? (
                        <span className="text-[8px] bg-gray-50 text-gray-400 font-medium border border-gray-200 px-1.5 rounded uppercase tracking-wider">
                          Assigned
                        </span>
                      ) : (
                        <span className="text-[8px] bg-amber-50 text-amber-600 font-bold border border-amber-200/50 px-1.5 rounded uppercase tracking-wider">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message window (Center panel) */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeUserId && 'hidden md:flex'}`}>
        {activeUserId && activeUser ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveUserId(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 md:hidden mr-1"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-gray-950/5 text-gray-800 font-extrabold flex items-center justify-center text-xs">
                  {activeUser.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{activeUser.name || 'User'}</h3>
                  {isUserTyping ? (
                    <p className="text-[10px] text-emerald-500 font-bold animate-pulse">typing...</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                      {activeUser.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeUser.assigned_admin_id === profile?.id ? (
                  <button
                    type="button"
                    onClick={handleClaimToggle}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-650 hover:bg-blue-100 border border-blue-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    <Check size={13} /> Claimed by Me (Release)
                  </button>
                ) : activeUser.assigned_admin_id ? (
                  <span className="text-xs text-gray-400 border bg-gray-50 border-gray-200 px-3 py-1.5 rounded-lg font-semibold cursor-not-allowed select-none">
                    Assigned
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimToggle}
                    className="inline-flex items-center gap-1 bg-brand text-white hover:bg-brand-dark text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                  >
                    Claim Conversation
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => setShowMobileDetails(true)}
                  className="lg:hidden p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition text-gray-600 font-bold shrink-0 flex items-center justify-center"
                  title="View user details"
                >
                  <User size={14} />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <RefreshCw size={18} className="animate-spin text-gray-400" />
                  <p className="text-xs text-gray-400 font-medium">Fetching secure inbox...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                  <Users size={28} className="text-gray-200 mb-2" />
                  <p className="text-xs font-semibold">No message history</p>
                  <p className="text-[10px] text-gray-300 mt-1">Send a message below to start the support session.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-2`}>
                      {!isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 transition mr-2 self-center shrink-0"
                          title="Delete message"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm relative ${
                        isMe 
                          ? 'bg-gradient-to-br from-brand to-indigo-600 text-white rounded-tr-none border border-brand/5 shadow-brand/10' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-100/85 shadow-slate-105'
                      }`}>
                        {isMe && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] font-extrabold text-blue-200">Support</span>
                            <span className="inline-flex items-center justify-center bg-white text-blue-600 rounded-full p-0.5 w-3 h-3 shadow-xs" title="Verified Support Account">
                              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          </div>
                        )}
                        <p className="leading-relaxed break-words font-medium">{msg.body}</p>
                        
                        <div className="flex items-center justify-end gap-1.5 mt-1.5">
                          <span className={`text-[9px] font-medium tabular-nums ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          
                          {isMe && (
                            <span className="shrink-0" title={msg.read ? "Read by user" : "Sent"}>
                              {msg.read ? (
                                <CheckCheck size={13} className="text-emerald-300" />
                              ) : (
                                <Check size={13} className="text-white/40" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 transition ml-2 self-center shrink-0"
                          title="Delete message"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input reply form */}
            <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-gray-100 flex gap-3 items-center shrink-0">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 text-white rounded-xl p-3 transition shadow-sm hover:shadow-md shrink-0 flex items-center justify-center disabled:text-gray-400"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <Users size={36} className="text-gray-200 mb-2" />
            <p className="text-sm font-semibold">Select a conversation thread</p>
            <p className="text-xs text-gray-300 mt-1 max-w-xs">Select a user thread from the left menu to view, reply, and view read receipts.</p>
          </div>
        )}
      </div>

      {/* User Context card (Right panel) */}
      {activeUserId && activeUser && (
        <div className="hidden lg:flex w-72 border-l border-gray-100 flex-col shrink-0 bg-white">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <Info size={15} className="text-gray-700" />
            <h4 className="font-bold text-gray-950 text-xs uppercase tracking-wider">User Details</h4>
          </div>

          <div className="p-5 flex-1 overflow-y-auto overscroll-contain space-y-6">
            
            {/* Quick Profile Summary */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-900/5 text-gray-900 rounded-2xl flex items-center justify-center font-bold text-xl mx-auto shadow-inner border border-gray-100">
                {activeUser.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h3 className="font-bold text-gray-950 text-sm mt-3">{activeUser.name || 'User'}</h3>
              <p className="text-xs text-gray-400 select-all font-medium mt-0.5">{activeUser.email}</p>
              <p className="text-[10px] text-gray-450 font-bold mt-2 uppercase tracking-wider">
                Last active: <span className="text-slate-800 font-extrabold">{formatLastSeen(activeUser.last_seen)}</span>
              </p>
            </div>

            <hr className="border-gray-50" />

            {/* Wallet Info */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Wallet size={15} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Wallet Balance</span>
              </div>
              <p className="text-lg font-extrabold text-gray-950 mt-1">{fmtCurrency(activeUser.wallet_balance)}</p>
            </div>

            {/* Account Status / Restriction Details */}
            <div className="space-y-3.5">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Status</h5>
              
              <div className="space-y-2 text-xs">
                {/* Ban Status */}
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Account status</span>
                  {activeUser.banned ? (
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <ShieldAlert size={11} /> Banned
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <ShieldCheck size={11} /> Active
                    </span>
                  )}
                </div>

                {/* Can Withdraw */}
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Withdraw permission</span>
                  <span className={`font-semibold ${activeUser.can_withdraw ? 'text-emerald-600' : 'text-red-500'}`}>
                    {activeUser.can_withdraw ? 'Allowed' : 'Suspended'}
                  </span>
                </div>

                {/* Can Invest */}
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Investment permission</span>
                  <span className={`font-semibold ${activeUser.can_invest ? 'text-emerald-600' : 'text-red-500'}`}>
                    {activeUser.can_invest ? 'Allowed' : 'Suspended'}
                  </span>
                </div>

                {/* Fee Requirement */}
                {activeUser.fee_required > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-amber-600 font-medium">Clearance fee required</span>
                    <span className="font-bold text-amber-700 tabular-nums">
                      {fmtCurrency(activeUser.fee_required)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <a 
                href={`/admin/users?search=${encodeURIComponent(activeUser.email)}`}
                className="w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition font-semibold text-xs flex items-center justify-center gap-2"
              >
                <User size={13} /> Manage User Account
              </a>
              <a 
                href={`/admin/logs?user=${activeUserId}`}
                className="w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition font-semibold text-xs flex items-center justify-center gap-2"
              >
                <Mail size={13} /> View Audit Logs
              </a>
              <button
                type="button"
                onClick={() => handleFollowToggle(activeUser.name || 'User')}
                className={`w-full py-2.5 rounded-xl border transition font-bold text-xs flex items-center justify-center gap-2 ${
                  followedInvestors.includes((activeUser.name || 'User').toLowerCase())
                    ? 'bg-blue-50 border-blue-200 text-blue-650 hover:bg-blue-100'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Bell size={13} />
                {followedInvestors.includes((activeUser.name || 'User').toLowerCase())
                  ? 'Following Investor'
                  : 'Follow Investor'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Start Conversation</h3>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none mb-4"
            />
            
            <div className="max-h-[280px] overflow-y-auto space-y-1">
              {allProfiles
                .filter(p => 
                  p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  p.email?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const existing = threads.find(t => t.user_id === p.id);
                      if (!existing) {
                        const temp: Thread = {
                          user_id: p.id,
                          user: p,
                          lastMessage: {
                            id: 'temp',
                            user_id: p.id,
                            sender_id: p.id,
                            body: 'No messages yet. Send a message to start.',
                            read: true,
                            created_at: new Date().toISOString()
                          },
                          unreadCount: 0
                        };
                        setThreads(prev => [temp, ...prev]);
                      }
                      setActiveUserId(p.id);
                      setSearchQuery('');
                      setShowNewChatModal(false);
                    }}
                    className="w-full p-3 flex items-center gap-3 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <div className="w-8 h-8 bg-brand/10 text-brand font-bold rounded-lg flex items-center justify-center text-xs shrink-0">
                      {p.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name || 'User'}</p>
                      <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    </div>
                  </button>
                ))}
              {allProfiles.length === 0 && (
                <p className="text-center py-6 text-xs text-gray-400">Loading users...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile User Context Details Modal */}
      {showMobileDetails && activeUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:hidden">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowMobileDetails(false)} />
          <div className="bg-white rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col z-10 overflow-hidden border shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand/10 text-brand rounded-lg shrink-0">
                  <Info size={15} />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">User Context details</h4>
              </div>
              <button onClick={() => setShowMobileDetails(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 bg-gray-50/30">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-900/5 text-gray-900 rounded-2xl flex items-center justify-center font-bold text-xl mx-auto border border-gray-150 shadow-inner">
                  {activeUser.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <h3 className="font-bold text-gray-950 text-sm mt-3">{activeUser.name || 'User'}</h3>
                <p className="text-xs text-gray-400 select-all font-medium mt-0.5">{activeUser.email}</p>
                <p className="text-[10px] text-gray-450 font-bold mt-2 uppercase tracking-wider">
                  Last active: <span className="text-slate-800 font-extrabold">{formatLastSeen(activeUser.last_seen)}</span>
                </p>
              </div>

              <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-450">
                  <Wallet size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Wallet Balance</span>
                </div>
                <p className="text-lg font-extrabold text-gray-950 mt-1">{fmtCurrency(activeUser.wallet_balance)}</p>
              </div>

              <div className="space-y-3">
                <h5 className="text-[9px] font-bold text-gray-450 uppercase tracking-wider">Account permissions</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Account status</span>
                    {activeUser.banned ? (
                      <span className="px-2.5 py-0.5 bg-red-50 text-red-650 border border-red-100 rounded-full font-bold text-[9px]">Banned</span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-650 border border-emerald-100 rounded-full font-bold text-[9px]">Active</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Withdraw permission</span>
                    <span className={`font-semibold ${activeUser.can_withdraw ? 'text-emerald-600' : 'text-red-550'}`}>{activeUser.can_withdraw ? 'Allowed' : 'Suspended'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Investment permission</span>
                    <span className={`font-semibold ${activeUser.can_invest ? 'text-emerald-600' : 'text-red-550'}`}>{activeUser.can_invest ? 'Allowed' : 'Suspended'}</span>
                  </div>
                  {activeUser.fee_required > 0 && (
                    <div className="flex items-center justify-between py-1 text-amber-700 font-semibold">
                      <span>Clearance fee required</span>
                      <span className="font-bold tabular-nums">{fmtCurrency(activeUser.fee_required)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <a
                  href={`/admin/users?search=${encodeURIComponent(activeUser.email)}`}
                  className="w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition font-semibold text-xs flex items-center justify-center gap-2 bg-white"
                >
                  <User size={13} /> Manage User Account
                </a>
                <a
                  href={`/admin/logs?user=${activeUserId}`}
                  className="w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition font-semibold text-xs flex items-center justify-center gap-2 bg-white"
                >
                  <Mail size={13} /> View Audit Logs
                </a>
                <button
                  type="button"
                  onClick={() => {
                    handleFollowToggle(activeUser.name || 'User');
                    setShowMobileDetails(false);
                  }}
                  className={`w-full py-2.5 rounded-xl border transition font-bold text-xs flex items-center justify-center gap-2 ${
                    followedInvestors.includes((activeUser.name || 'User').toLowerCase())
                      ? 'bg-blue-50 border-blue-200 text-blue-650 hover:bg-blue-100'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'
                  }`}
                >
                  <Bell size={13} />
                  {followedInvestors.includes((activeUser.name || 'User').toLowerCase())
                    ? 'Following Investor'
                    : 'Follow Investor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
