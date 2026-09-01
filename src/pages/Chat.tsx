import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { 
  Send, Check, CheckCheck, HelpCircle, RefreshCw, Bell, BellOff,
  Users, UserPlus, Search, X, ShieldAlert, UserCheck, CheckCircle2,
  UserX, Headphones, Clock, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { sendEmailAndLog, notifyUser } from '../lib/notify';
import { isDifferentDay, formatChatDateSeparator, formatMessageTime } from '../lib/chatDate';
import AdminChat from './admin/AdminChat';

interface SupportMessage {
  id: string;
  user_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  created_at: string;
  sender_profile?: { id: string; name: string; email: string };
  receiver_profile?: { id: string; name: string; email: string };
}

interface FriendUser {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

const SMART_SUGGESTIONS = [
  "How do I make a deposit?",
  "What is the interest rate on staking plans?",
  "How long do withdrawals take to process?",
  "Can I check my property listing investments?"
];

export default function Chat() {
  const { profile } = useAuthStore();
  const { subscribed, subscribe, unsubscribe } = usePushNotifications(profile?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  // Active chat state: 'support' or a friend's user_id
  const [activeChat, setActiveChat] = useState<string>(() => searchParams.get('user') || 'support');
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('chat');

  // Support messages
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  
  // Direct messages (for active friend)
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  
  // Friends & Requests
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  
  // Search & Add User Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);

  // Inputs & Loading
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // If Admin, render AdminChat
  if (profile?.is_admin) {
    return <AdminChat />;
  }

  // Fetch Support Messages
  const fetchSupportMessages = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setSupportMessages(data);
        if (activeChat === 'support') scrollToBottom();
      }
    } catch (err) {
      console.warn('Failed to load support messages:', err);
    }
  };

  // Fetch Friends (accepted friend_requests)
  const fetchFriendsAndRequests = async () => {
    if (!profile?.id) return;
    try {
      // 1. Fetch friend requests where user is sender or receiver
      const { data: reqs, error: reqsErr } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);

      if (reqsErr) throw reqsErr;

      const incoming: FriendRequest[] = [];
      const acceptedFriendIds: string[] = [];

      for (const r of (reqs || [])) {
        if (r.status === 'accepted') {
          const fId = r.sender_id === profile.id ? r.receiver_id : r.sender_id;
          acceptedFriendIds.push(fId);
        } else if (r.status === 'pending') {
          if (r.receiver_id === profile.id) incoming.push(r);
        }
      }

      // Fetch profiles for friends & requests
      const allUserIds = Array.from(new Set([
        ...acceptedFriendIds,
        ...incoming.map(i => i.sender_id),
      ]));

      if (allUserIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', allUserIds);

        const profileMap = new Map((userProfiles || []).map(p => [p.id, p]));

        // Enrich incoming
        incoming.forEach(i => { i.sender_profile = profileMap.get(i.sender_id); });

        // Build friends list
        const friendList: FriendUser[] = acceptedFriendIds.map(fId => {
          const p = profileMap.get(fId);
          return {
            id: fId,
            name: p?.name || 'Investor Member',
            email: p?.email || '',
          };
        });

        setFriends(friendList);
      } else {
        setFriends([]);
      }

      setIncomingRequests(incoming);
    } catch (err) {
      console.warn('Failed loading friends/requests:', err);
    }
  };

  // Fetch Direct Messages when a friend is active
  const fetchDirectMessages = async (friendId: string) => {
    if (!profile?.id || !friendId) return;
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setDirectMessages(data);
        scrollToBottom();
      }

      // Mark read
      await supabase
        .from('direct_messages')
        .update({ read: true })
        .eq('sender_id', friendId)
        .eq('receiver_id', profile.id)
        .eq('read', false);
    } catch (err) {
      console.warn('Failed loading direct messages:', err);
    }
  };

  useEffect(() => {
    fetchSupportMessages();
    fetchFriendsAndRequests();
  }, [profile?.id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const userParam = searchParams.get('user');
    if (tab === 'support') {
      setActiveChat('support');
      setMobileView('chat');
    } else if (userParam) {
      setActiveChat(userParam);
      setMobileView('chat');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeChat === 'support') {
      fetchSupportMessages();
      setActiveFriend(null);
    } else {
      const friend = friends.find(f => f.id === activeChat);
      if (friend) {
        setActiveFriend(friend);
        fetchDirectMessages(friend.id);
      }
    }
  }, [activeChat, friends]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!profile?.id) return;

    // Support messages channel
    const supportSub = supabase
      .channel(`user-support-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${profile.id}` }, (payload) => {
        setSupportMessages(prev => [...prev, payload.new as SupportMessage]);
        if (activeChat === 'support') scrollToBottom();
      })
      .subscribe();

    // Direct messages channel
    const directSub = supabase
      .channel(`user-direct-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const newMsg = payload.new as DirectMessage;
        if (
          (newMsg.sender_id === profile.id && newMsg.receiver_id === activeChat) ||
          (newMsg.sender_id === activeChat && newMsg.receiver_id === profile.id)
        ) {
          setDirectMessages(prev => [...prev, newMsg]);
          scrollToBottom();
        } else {
          // Update friends list unread
          fetchFriendsAndRequests();
        }
      })
      .subscribe();

    // Friend requests channel
    const reqsSub = supabase
      .channel(`user-requests-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        fetchFriendsAndRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(supportSub);
      supabase.removeChannel(directSub);
      supabase.removeChannel(reqsSub);
    };
  }, [profile?.id, activeChat]);

  // Push toggle
  const handlePushToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast.success('Push notifications disabled');
    } else {
      await subscribe();
      toast.success('Push notifications active!');
    }
  };

  // Search users for friend request
  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || !profile) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('id', profile.id)
        .or(`name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`)
        .limit(10);

      if (!error && data) {
        // Exclude existing friends
        const existingIds = new Set(friends.map(f => f.id));
        setSearchResults(data.filter(u => !existingIds.has(u.id)));
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Send friend request
  const handleSendFriendRequest = async (targetUser: FriendUser) => {
    if (!profile) return;
    try {
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: profile.id,
        receiver_id: targetUser.id,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') {
          toast.info('A friend request has already been sent to this user.');
          return;
        }
        throw error;
      }

      // In-app notification for receiver
      await notifyUser({
        userId: targetUser.id,
        title: 'New Friend Request',
        message: `${profile.name || profile.email} sent you a connection request.`,
        type: 'info',
        link: '/app/chat',
      });

      // Email notification
      if (targetUser.email) {
        sendEmailAndLog(
          targetUser.email,
          `[RPM] New Connection Request from ${profile.name || 'an Investor'}`,
          `<p>${profile.name || profile.email} would like to connect with you on Rema Profit Machine. Log in to accept the request.</p>`
        ).catch(() => {});
      }

      toast.success(`Connection request sent to ${targetUser.name}!`);
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
      fetchFriendsAndRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request');
    }
  };

  // Accept / Decline friend request
  const handleRespondRequest = async (requestId: string, status: 'accepted' | 'declined', senderId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      if (status === 'accepted') {
        toast.success('Connection request accepted! You can now message each other.');
        // Notify sender
        await notifyUser({
          userId: senderId,
          title: 'Friend Request Accepted',
          message: `${profile?.name || 'A user'} accepted your connection request. You can now chat!`,
          type: 'success',
          link: '/app/chat',
        });
      } else {
        toast.info('Connection request declined.');
      }
      fetchFriendsAndRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update request');
    }
  };

  // Send Message (Support or Direct)
  const handleSendMessage = async (msgText: string) => {
    const cleanText = msgText.trim();
    if (!cleanText || !profile || sending) return;
    setSending(true);
    setText('');

    try {
      if (activeChat === 'support') {
        // Send to Support Desk
        const { data: insertedMsg, error } = await supabase
          .from('messages')
          .insert({
            user_id: profile.id,
            sender_id: profile.id,
            body: cleanText,
            read: false,
          })
          .select()
          .single();

        if (error) throw error;
        if (insertedMsg) {
          setSupportMessages(prev => prev.some(m => m.id === insertedMsg.id) ? prev : [...prev, insertedMsg]);
        }
        scrollToBottom();
      } else {
        // Send Direct Message to friend
        const targetReceiverId = activeFriend ? activeFriend.id : activeChat;
        const { data: insertedDm, error } = await supabase
          .from('direct_messages')
          .insert({
            sender_id: profile.id,
            receiver_id: targetReceiverId,
            body: cleanText,
            read: false,
          })
          .select()
          .single();

        if (error) throw error;
        if (insertedDm) {
          setDirectMessages(prev => prev.some(m => m.id === insertedDm.id) ? prev : [...prev, insertedDm]);
        }
        scrollToBottom();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100dvh-160px)] md:h-[calc(100dvh-120px)] mb-16 md:mb-0 bg-white border border-gray-200/80 shadow-sm rounded-3xl flex overflow-hidden">
      
      {/* ── LEFT COLUMN: THREAD LIST (SUPPORT + DIRECT MESSAGES) ── */}
      <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col shrink-0 bg-slate-50/40 ${
        mobileView === 'chat' ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Inbox Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="font-extrabold text-sm text-gray-900">Communication Desk</h2>
            <p className="text-[10px] text-gray-400">Support & Direct Investor Chat</p>
          </div>
          <div className="flex items-center gap-1">
            {incomingRequests.length > 0 && (
              <button
                onClick={() => setShowRequestsModal(true)}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow-xs transition animate-pulse flex items-center gap-1"
                title="Pending friend requests"
              >
                <Clock size={11} /> {incomingRequests.length}
              </button>
            )}
            <button
              onClick={() => { setShowAddUserModal(true); setSearchResults([]); setSearchQuery(''); }}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition"
              title="Add user / search connections"
            >
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        {/* 1. PINNED OFFICIAL SUPPORT DESK (Always at the very top, bypasses friends, cannot be blocked) */}
        <div className="p-3 border-b border-gray-100 bg-emerald-50/20">
          <button
            onClick={() => {
              setActiveChat('support');
              setMobileView('chat');
              setSearchParams({ tab: 'support' });
            }}
            className={`w-full p-3 rounded-2xl transition text-left flex items-start gap-3 border ${
              activeChat === 'support'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-white text-gray-900 border-gray-200/80 hover:border-brand/40 shadow-xs'
            }`}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0 ring-2 ring-emerald-500/20">
              <Headphones size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-xs flex items-center gap-1 truncate">
                  <span className="truncate">RPM Official Support</span>
                  <CheckCircle2 size={13} className="text-blue-400 shrink-0" />
                </h4>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                  activeChat === 'support' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  24/7 Priority
                </span>
              </div>
              <p className={`text-[11px] truncate mt-0.5 ${activeChat === 'support' ? 'text-slate-300' : 'text-gray-500'}`}>
                {supportMessages.length > 0 ? supportMessages[supportMessages.length - 1].body : 'Contact live executive support desk'}
              </p>
            </div>
          </button>
        </div>

        {/* 2. DIRECT INVESTOR MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-50">
          <div className="px-4 py-2 bg-gray-50/60 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <span>Direct Investor Chats ({friends.length})</span>
            {friends.length > 0 && (
              <button onClick={() => setShowAddUserModal(true)} className="text-brand hover:underline">
                + Add User
              </button>
            )}
          </div>

          {friends.length === 0 ? (
            <div className="py-12 text-center px-4 space-y-3">
              <Users size={28} className="text-gray-300 mx-auto" />
              <div>
                <p className="text-xs font-bold text-gray-700">No Direct Chats Yet</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                  Search other verified platform members by name to send a connection request.
                </p>
              </div>
              <button
                onClick={() => { setShowAddUserModal(true); setSearchResults([]); setSearchQuery(''); }}
                className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                Find & Add Members
              </button>
            </div>
          ) : (
            friends.map(f => {
              const active = activeChat === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveChat(f.id);
                    setMobileView('chat');
                    setSearchParams({ user: f.id });
                  }}
                  className={`w-full p-3.5 flex items-center gap-3 transition text-left border-l-4 ${
                    active
                      ? 'bg-brand/5 border-brand'
                      : 'border-transparent hover:bg-gray-50/60'
                  }`}
                >
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 shadow-xs">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center">
                      <h5 className="font-bold text-xs text-gray-900 truncate">{f.name}</h5>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {f.email}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── CENTER / RIGHT: CHAT DISPLAY PANE ── */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white ${
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Chat Pane Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 text-white shrink-0 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileView('list')}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 md:hidden shrink-0"
              title="Back to inbox list"
            >
              <ArrowLeft size={16} />
            </button>

            {activeChat === 'support' ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-tr from-brand to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                  <Headphones size={18} />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm flex items-center gap-1.5 truncate">
                    <span className="truncate">RPM Official Support Desk</span>
                    <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                  </h1>
                  <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                    Verified Official Account • 24/7 Live Concierge
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-white/10 text-white rounded-2xl flex items-center justify-center font-bold text-sm shrink-0">
                  {activeFriend?.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm truncate">{activeFriend?.name}</h1>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">{activeFriend?.email}</p>
                </div>
              </div>
            )}
          </div>

          {/* Push Notification Toggle for Support */}
          {activeChat === 'support' && (
            <button
              onClick={handlePushToggle}
              title={subscribed ? "Push notifications active" : "Enable push alerts"}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border shrink-0 ${
                subscribed
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/10 text-gray-300 border-white/5 hover:bg-white/15'
              }`}
            >
              {subscribed ? <Bell size={13} className="shrink-0" /> : <BellOff size={13} className="shrink-0" />}
              <span className="hidden sm:inline whitespace-nowrap">{subscribed ? 'Push Alerts Active' : 'Enable Push Alerts'}</span>
            </button>
          )}
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 bg-slate-50/30">
          
          {/* Support Welcome banner */}
          {activeChat === 'support' && (
            <div className="max-w-[85%] mx-auto bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm text-center mb-6">
              <div className="w-10 h-10 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <HelpCircle size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">How can we assist your portfolio today?</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Our executive support team is available 24/7 to assist with deposits, staking yields, property conveyance, or P2P escrow settlements.
              </p>
              {/* Quick Suggestions */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SMART_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSendMessage(s)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-brand hover:text-white rounded-xl text-xs font-semibold text-gray-700 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Active Messages (Support or Direct) */}
          {(activeChat === 'support' ? supportMessages : directMessages).map((msg, index) => {
            const isMe = msg.sender_id === profile?.id;
            const messagesArray = activeChat === 'support' ? supportMessages : directMessages;
            const prevMsg = index > 0 ? messagesArray[index - 1] : null;
            const showDateDivider = !prevMsg || isDifferentDay(prevMsg.created_at, msg.created_at);

            return (
              <div key={msg.id || index} className="space-y-3">
                {showDateDivider && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="bg-slate-200/70 text-slate-600 text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-xs border border-slate-300/60">
                      {formatChatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] min-w-[70px] rounded-2xl px-4 py-3 shadow-sm text-sm break-words whitespace-pre-wrap ${
                    isMe 
                      ? 'bg-gradient-to-br from-brand to-indigo-600 text-white rounded-tr-none border border-brand/5 shadow-brand/10' 
                      : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-slate-100'
                  }`}>
                    {/* Header for support or partner */}
                    {!isMe && activeChat === 'support' && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-extrabold text-blue-600">RPM Support</span>
                        <CheckCircle2 size={11} className="text-blue-600" />
                      </div>
                    )}
                    <p className="leading-relaxed font-medium">{msg.body}</p>
                    
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      <span className={`text-[9px] font-medium tabular-nums ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                        {formatMessageTime(msg.created_at)}
                      </span>
                      {isMe && (
                        <span className="shrink-0">
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
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(text); }} 
          className="p-4 bg-white border-t border-slate-100 flex gap-3 items-center shrink-0"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeChat === 'support' ? "Type message to support desk..." : `Message ${activeFriend?.name || 'user'}...`}
            className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-slate-50/50"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="bg-brand hover:bg-brand-dark disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-2xl p-3.5 transition shadow-md shadow-brand/10 shrink-0 flex items-center justify-center"
          >
            {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>

      {/* ── MODAL: SEARCH & ADD USER (WITH ANTI-SPAM WARNING) ── */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-brand" />
                <h3 className="font-bold text-gray-900 text-base">Connect with Platform Members</h3>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>

            {/* Strict Anti-Spam Security Warning */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-bold text-amber-950 block">SECURITY & ANTI-SPAM POLICY:</strong>
                Please only send connection requests to individuals you personally know. Sending unsolicited connection requests or harassment violates community guidelines and will result in <strong className="underline font-bold">immediate and permanent account suspension</strong>.
              </div>
            </div>

            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchUsers()}
                  placeholder="Search by full name or email..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand"
                />
              </div>
              <button
                onClick={handleSearchUsers}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-xs transition disabled:opacity-60"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 space-y-1">
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-xs text-gray-400 text-center py-6">No matching users found.</p>
              )}
              {searchResults.map(u => (
                <div key={u.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-xs text-gray-900">{u.name}</h5>
                    <p className="text-[10px] text-gray-400">{u.email}</p>
                  </div>
                  <button
                    onClick={() => handleSendFriendRequest(u)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <UserPlus size={12} /> Send Request
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PENDING FRIEND REQUESTS ── */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Incoming Connection Requests</h3>
              <button onClick={() => setShowRequestsModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>

            {incomingRequests.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No pending friend requests.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {incomingRequests.map(req => (
                  <div key={req.id} className="py-3 flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-xs text-gray-900">{req.sender_profile?.name || 'Investor Member'}</h5>
                      <p className="text-[10px] text-gray-400">{req.sender_profile?.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondRequest(req.id, 'accepted', req.sender_id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
                      >
                        <UserCheck size={12} /> Accept
                      </button>
                      <button
                        onClick={() => handleRespondRequest(req.id, 'declined', req.sender_id)}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        <UserX size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
