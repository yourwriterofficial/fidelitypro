import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { 
  Send, Check, CheckCheck, HelpCircle, RefreshCw, Bell, BellOff,
  Users, UserPlus, Search, X, ShieldAlert, UserCheck, CheckCircle2,
  UserX, MessageSquare, Clock, ArrowLeft, Share2, Copy, Lock,
  ShieldCheck, HeartHandshake, ChevronRight, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { sendEmailAndLog, notifyUser, notifyAdmins } from '../lib/notify';
import { isDifferentDay, formatChatDateSeparator, formatMessageTime } from '../lib/chatDate';
import AdminChat from './admin/AdminChat';

interface SupportMessage {
  id: string;
  user_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read: boolean;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read: boolean;
}

interface FriendProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender_profile?: FriendProfile;
}

type ContactRelationship = 'sponsor' | 'referral' | 'friend';

interface FriendUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageIsMe?: boolean;
  unreadCount?: number;
  relationship?: ContactRelationship;
}

interface NetworkContact {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  relationship: 'sponsor' | 'referral';
  joinedAt?: string;
  isConnected?: boolean;
}

const SMART_SUGGESTIONS = [
  "How do I make a deposit?",
  "What is the interest rate on staking plans?",
  "How long do withdrawals take to process?",
  "Can I check my property listing investments?"
];

export default function Chat() {
  const { profile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscribed, subscribe, unsubscribe } = usePushNotifications(profile?.id);

  // Left Sidebar Tab: 'chats' | 'network' | 'support'
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'network' | 'support'>('chats');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Messages state
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Social & Network Contacts state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [rawRequests, setRawRequests] = useState<FriendRequest[]>([]);
  const [uplineContact, setUplineContact] = useState<NetworkContact | null>(null);
  const [downlineContacts, setDownlineContacts] = useState<NetworkContact[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);

  // Search & Filter state
  const [chatFilter, setChatFilter] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const referralLink = useMemo(() => {
    if (!profile?.referral_code) return `${window.location.origin}/signup`;
    return `${window.location.origin}/signup?ref=${profile.referral_code}`;
  }, [profile?.referral_code]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const viewParam = searchParams.get('view');
  if (profile?.is_admin && viewParam !== 'user') {
    return (
      <div className="space-y-2">
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold rounded-2xl shadow-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Viewing as Admin: Support Tickets Desk
          </span>
          <button 
            onClick={() => setSearchParams({ view: 'user' })}
            className="px-3 py-1 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Preview Member Inbox & Network →
          </button>
        </div>
        <AdminChat />
      </div>
    );
  }

  // ── Fetch Support Messages ──────────────────────────────────────────────────
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

      // Mark unread support replies from staff as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('user_id', profile.id)
        .neq('sender_id', profile.id)
        .eq('read', false);
    } catch (err) {
      console.warn('Failed to load support messages:', err);
    }
  };

  // ── Fetch Network Contacts (Sponsor & Referrals) ────────────────────────────
  const fetchNetworkContacts = async () => {
    if (!profile?.id) return;
    setNetworkLoading(true);
    try {
      // 1. Fetch Upline / Sponsor
      if (profile.referred_by) {
        const { data: upline } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .eq('id', profile.referred_by)
          .maybeSingle();

        if (upline) {
          setUplineContact({
            id: upline.id,
            name: upline.name || 'Your Sponsor',
            email: upline.email,
            avatar_url: upline.avatar_url,
            relationship: 'sponsor',
          });
        }
      } else {
        setUplineContact(null);
      }

      // 2. Fetch Downlines / Referrals
      const { data: downlines } = await supabase
        .from('referrals')
        .select('id, created_at, referee:referee_id(id, name, email, avatar_url)')
        .eq('referrer_id', profile.id)
        .order('created_at', { ascending: false });

      if (downlines) {
        const formattedDownlines: NetworkContact[] = downlines
          .filter((d: any) => d.referee && d.referee.id)
          .map((d: any) => ({
            id: d.referee.id,
            name: d.referee.name || 'Network Member',
            email: d.referee.email,
            avatar_url: d.referee.avatar_url,
            relationship: 'referral',
            joinedAt: d.created_at,
          }));
        setDownlineContacts(formattedDownlines);
      }
    } catch (err) {
      console.warn('Error loading network contacts:', err);
    } finally {
      setNetworkLoading(false);
    }
  };

  // ── Fetch Friends, Direct Messages & Requests ──────────────────────────────
  const fetchFriendsAndRequests = async () => {
    if (!profile?.id) return;
    try {
      // 1. Fetch friend requests
      const { data: reqs, error: reqsErr } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);

      if (reqsErr) throw reqsErr;
      setRawRequests(reqs || []);

      const incoming: FriendRequest[] = [];
      const acceptedFriendIds: string[] = [];

      for (const r of (reqs || [])) {
        if (r.status === 'accepted') {
          const fId = r.sender_id === profile.id ? r.receiver_id : r.sender_id;
          if (!acceptedFriendIds.includes(fId)) {
            acceptedFriendIds.push(fId);
          }
        } else if (r.status === 'pending') {
          if (r.receiver_id === profile.id) incoming.push(r);
        }
      }

      // 2. Fetch recent direct messages to populate conversation previews & unread counts
      const { data: recentDms } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(250);

      const lastMsgMap = new Map<string, { body: string; created_at: string; sender_id: string }>();
      const unreadMap = new Map<string, number>();

      (recentDms || []).forEach(dm => {
        const partnerId = dm.sender_id === profile.id ? dm.receiver_id : dm.sender_id;
        if (!lastMsgMap.has(partnerId)) {
          lastMsgMap.set(partnerId, { body: dm.body, created_at: dm.created_at, sender_id: dm.sender_id });
        }
        if (dm.receiver_id === profile.id && !dm.read) {
          unreadMap.set(partnerId, (unreadMap.get(partnerId) || 0) + 1);
        }
      });

      // Include all contacts we have accepted or have exchanged messages with
      const allContactIds = Array.from(new Set([
        ...acceptedFriendIds,
        ...Array.from(lastMsgMap.keys()),
        ...incoming.map(i => i.sender_id),
      ]));

      if (allContactIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', allContactIds);

        const profileMap = new Map((userProfiles || []).map(p => [p.id, p]));

        // Enrich incoming requests
        incoming.forEach(i => { i.sender_profile = profileMap.get(i.sender_id); });

        // Build active friends list
        const activeIds = Array.from(new Set([...acceptedFriendIds, ...Array.from(lastMsgMap.keys())]));
        const friendList: FriendUser[] = activeIds.map(fId => {
          const p = profileMap.get(fId);
          const last = lastMsgMap.get(fId);
          const unread = unreadMap.get(fId) || 0;
          
          let relationship: ContactRelationship = 'friend';
          if (profile.referred_by === fId) {
            relationship = 'sponsor';
          }

          return {
            id: fId,
            name: p?.name || 'Investor Member',
            email: p?.email || '',
            avatar_url: p?.avatar_url,
            lastMessage: last?.body,
            lastMessageTime: last?.created_at,
            lastMessageIsMe: last?.sender_id === profile.id,
            unreadCount: unread,
            relationship,
          };
        });

        // Sort by most recent message activity
        friendList.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
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

  // ── Fetch Direct Messages for active friend ────────────────────────────────
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

      // Mark read in DB
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

  // Initial loads
  useEffect(() => {
    fetchSupportMessages();
    fetchNetworkContacts();
    fetchFriendsAndRequests();
  }, [profile?.id]);

  // Handle URL query parameters (?tab=support or ?user=<id>)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const userParam = searchParams.get('user');

    if (tab === 'support') {
      setSidebarTab('support');
      setActiveChat('support');
      setActiveFriend(null);
      setMobileView('chat');
    } else if (userParam) {
      setSidebarTab('chats');
      setActiveChat(userParam);
      setMobileView('chat');
    }
  }, [searchParams]);

  // Sync active friend details when activeChat changes
  useEffect(() => {
    if (activeChat === 'support') {
      fetchSupportMessages();
      setActiveFriend(null);
    } else if (activeChat) {
      const friend = friends.find(f => f.id === activeChat);
      if (friend) {
        setActiveFriend(friend);
        fetchDirectMessages(friend.id);
      } else {
        // Active chat might be a network contact not yet in friends list
        supabase.from('profiles').select('id, name, email, avatar_url').eq('id', activeChat).single().then(({ data }) => {
          if (data) {
            const tempFriend: FriendUser = {
              id: data.id,
              name: data.name || 'Investor Member',
              email: data.email,
              avatar_url: data.avatar_url,
              relationship: profile?.referred_by === data.id ? 'sponsor' : 'friend',
            };
            setActiveFriend(tempFriend);
            fetchDirectMessages(data.id);
          }
        });
      }
    }
  }, [activeChat, friends]);

  // Real-time Supabase subscriptions
  useEffect(() => {
    if (!profile?.id) return;

    // Support messages channel
    const supportSub = supabase
      .channel(`user-support-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${profile.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as SupportMessage;
          setSupportMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          if (activeChat === 'support') {
            scrollToBottom();
            if (newMsg.sender_id !== profile.id) {
              supabase.from('messages').update({ read: true }).eq('id', newMsg.id).then();
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as SupportMessage;
          setSupportMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      })
      .subscribe();

    // Direct messages channel
    const directSub = supabase
      .channel(`user-direct-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as DirectMessage;
          if (
            (newMsg.sender_id === profile.id && newMsg.receiver_id === activeChat) ||
            (newMsg.sender_id === activeChat && newMsg.receiver_id === profile.id)
          ) {
            setDirectMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            scrollToBottom();
            if (newMsg.receiver_id === profile.id && activeChat === newMsg.sender_id) {
              supabase.from('direct_messages').update({ read: true }).eq('id', newMsg.id).then();
            }
          }
          // Refresh list for last message & unread badge
          fetchFriendsAndRequests();
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as DirectMessage;
          setDirectMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
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

  // Push notifications toggle
  const handlePushToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast.success('Push notifications disabled');
    } else {
      await subscribe();
      toast.success('Push notifications active!');
    }
  };

  // Copy personal invite / referral link
  const copyInviteLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Chat invite link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Share via Web Share API or copy fallback
  const handleShareInvite = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Chat with me on RPM (Rema Profit Machine)',
        text: 'Connect and chat with me directly on Rema Profit Machine to discuss investment strategies and real-time yields.',
        url: referralLink,
      }).catch(() => {});
    } else {
      copyInviteLink();
    }
  };

  // 1-Click Connect & Start Chatting with a Network Contact (Sponsor or Referral)
  const handleConnectAndChat = async (contact: NetworkContact) => {
    if (!profile) return;
    try {
      // Check if already in friend_requests
      const existing = rawRequests.find(r => 
        (r.sender_id === profile.id && r.receiver_id === contact.id) ||
        (r.sender_id === contact.id && r.receiver_id === profile.id)
      );

      if (!existing) {
        // Auto-connect since they belong to the verified network tree
        await supabase.from('friend_requests').insert({
          sender_id: profile.id,
          receiver_id: contact.id,
          status: 'accepted',
        });
      } else if (existing.status !== 'accepted') {
        await supabase
          .from('friend_requests')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }

      const targetFriend: FriendUser = {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        avatar_url: contact.avatar_url,
        relationship: contact.relationship,
      };

      setFriends(prev => {
        if (prev.some(f => f.id === contact.id)) return prev;
        return [targetFriend, ...prev];
      });

      setActiveChat(contact.id);
      setActiveFriend(targetFriend);
      setMobileView('chat');
      setSearchParams({ user: contact.id });
      setSidebarTab('chats');
      fetchDirectMessages(contact.id);
      fetchFriendsAndRequests();
      toast.success(`Connected with ${contact.name}! You can message directly.`);
    } catch (err: any) {
      toast.error(err.message || 'Could not initiate chat');
    }
  };

  // Search users for new friend requests
  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || !profile) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .neq('id', profile.id)
        .or(`name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`)
        .limit(10);

      if (!error && data) {
        const existingFriendIds = new Set(friends.map(f => f.id));
        setSearchResults(data.filter(u => !existingFriendIds.has(u.id)));
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Send friend request
  const handleSendFriendRequest = async (targetUser: FriendProfile) => {
    if (!profile) return;
    try {
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: profile.id,
        receiver_id: targetUser.id,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') {
          toast.info('A connection request has already been sent to this user.');
          return;
        }
        throw error;
      }

      await notifyUser({
        userId: targetUser.id,
        title: 'New Connection Request',
        message: `${profile.name || profile.email} sent you a connection request.`,
        type: 'info',
        link: '/app/chat',
      });

      if (targetUser.email) {
        sendEmailAndLog(
          targetUser.email,
          `[RPM] Connection Request from ${profile.name || 'a Platform Member'}`,
          `<p>${profile.name || profile.email} would like to connect with you on Rema Profit Machine. Log in to your inbox to accept and start chatting.</p>`
        ).catch(() => {});
      }

      toast.success(`Connection request sent to ${targetUser.name}!`);
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
      fetchFriendsAndRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request');
    }
  };

  // Respond to friend request (Accept / Decline)
  const handleRespondRequest = async (requestId: string, status: 'accepted' | 'declined', senderId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      if (status === 'accepted') {
        toast.success('Connection request accepted! You can now message each other.');
        await notifyUser({
          userId: senderId,
          title: 'Connection Request Accepted',
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
          const userName = profile?.name || profile?.email || 'Investor';
          notifyAdmins({
            title: `[Support Chat] ${userName}`,
            message: `${userName}: "${cleanText.slice(0, 75)}${cleanText.length > 75 ? '...' : ''}"`,
            type: 'alert',
            link: '/admin/chat',
          });
        }
        scrollToBottom();
      } else {
        const targetReceiverId = activeFriend ? activeFriend.id : activeChat;
        if (!targetReceiverId) return;

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
          notifyUser({
            userId: targetReceiverId,
            title: `New Message from ${profile?.name || 'Contact'}`,
            message: `${cleanText.slice(0, 75)}${cleanText.length > 75 ? '...' : ''}`,
            type: 'info',
            link: '/app/chat',
          });
        }
        scrollToBottom();
        fetchFriendsAndRequests();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Filtered direct chats
  const filteredFriends = useMemo(() => {
    if (!chatFilter.trim()) return friends;
    const q = chatFilter.toLowerCase();
    return friends.filter(f => 
      f.name.toLowerCase().includes(q) || 
      f.email.toLowerCase().includes(q) ||
      (f.lastMessage && f.lastMessage.toLowerCase().includes(q))
    );
  }, [friends, chatFilter]);

  const totalNetworkCount = (uplineContact ? 1 : 0) + downlineContacts.length;
  const totalUnreadDirect = friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

  return (
    <div className="flex flex-col h-[calc(100dvh-160px)] md:h-[calc(100dvh-120px)] mb-16 md:mb-0">
      {profile?.is_admin && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-2xl mb-2 flex items-center justify-between text-xs font-bold shadow-xs shrink-0">
          <span>Admin Preview: Member Inbox & Network View</span>
          <button 
            onClick={() => setSearchParams({})}
            className="underline hover:text-white"
          >
            Return to Admin Desk →
          </button>
        </div>
      )}
      <div className="flex-1 bg-white border border-gray-200/80 shadow-sm rounded-3xl flex overflow-hidden">
      
      {/* ── LEFT COLUMN: INBOX & DISCOVERY PANEL ───────────────────────────── */}
      <div className={`w-full md:w-96 border-r border-gray-100 flex flex-col shrink-0 bg-slate-50/40 ${
        mobileView === 'chat' ? 'hidden md:flex' : 'flex'
      }`}>

        {/* 1. Header with Title & Quick Actions */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-extrabold text-base text-gray-900 tracking-tight flex items-center gap-1.5">
                <span>Inbox & Messages</span>
              </h2>
              <p className="text-[11px] text-gray-500 font-medium">Chat 1-on-1 with people you know</p>
            </div>

            <div className="flex items-center gap-1.5">
              {incomingRequests.length > 0 && (
                <button
                  onClick={() => setShowRequestsModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition animate-pulse flex items-center gap-1"
                  title="Pending connection requests"
                >
                  <Clock size={12} /> {incomingRequests.length}
                </button>
              )}

              <button
                onClick={handleShareInvite}
                className="p-2 hover:bg-gray-100 text-gray-600 hover:text-brand rounded-xl transition"
                title="Invite people you know to chat"
              >
                <Share2 size={17} />
              </button>

              <button
                onClick={() => { setShowAddUserModal(true); setSearchResults([]); setSearchQuery(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-xs transition"
                title="Start a new chat or find a friend"
              >
                <UserPlus size={14} />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* 2. Top Segmented Navigation Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl text-xs font-bold text-gray-600">
            <button
              onClick={() => setSidebarTab('chats')}
              className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 relative ${
                sidebarTab === 'chats'
                  ? 'bg-white text-gray-900 shadow-xs font-extrabold'
                  : 'hover:text-gray-900'
              }`}
            >
              <MessageCircle size={14} className={sidebarTab === 'chats' ? 'text-brand' : 'text-gray-400'} />
              <span>Direct</span>
              {totalUnreadDirect > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand text-white text-[9px] font-extrabold flex items-center justify-center">
                  {totalUnreadDirect}
                </span>
              )}
            </button>

            <button
              onClick={() => setSidebarTab('network')}
              className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 relative ${
                sidebarTab === 'network'
                  ? 'bg-white text-gray-900 shadow-xs font-extrabold'
                  : 'hover:text-gray-900'
              }`}
            >
              <Users size={14} className={sidebarTab === 'network' ? 'text-indigo-600' : 'text-gray-400'} />
              <span>Network</span>
              {totalNetworkCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {totalNetworkCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSidebarTab('support');
                setActiveChat('support');
                setActiveFriend(null);
                setSearchParams({ tab: 'support' });
                setMobileView('chat');
              }}
              className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'support' || activeChat === 'support'
                  ? 'bg-white text-gray-900 shadow-xs font-extrabold'
                  : 'hover:text-gray-900'
              }`}
            >
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Support</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            </button>
          </div>
        </div>

        {/* ── TAB 1: DIRECT CHATS (CONVERSATIONS WITH FRIENDS & CONTACTS) ── */}
        {sidebarTab === 'chats' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search within conversations */}
            {friends.length > 0 && (
              <div className="p-3 border-b border-gray-100 bg-white">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={chatFilter}
                    onChange={e => setChatFilter(e.target.value)}
                    placeholder="Search direct conversations..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand outline-none"
                  />
                </div>
              </div>
            )}

            {/* Direct Messages List */}
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-50">
              {friends.length === 0 ? (
                <div className="p-6 text-center space-y-4 my-auto">
                  <div className="w-14 h-14 bg-gradient-to-tr from-brand/10 to-indigo-100 text-brand rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                    <HeartHandshake size={28} className="text-brand" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">Chat with People You Know</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xs mx-auto">
                      Connect directly with your sponsor, investors you introduced, or search platform members by email.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setSidebarTab('network')}
                      className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 border border-indigo-200/60"
                    >
                      <Users size={14} />
                      <span>View People in Your Network ({totalNetworkCount})</span>
                      <ChevronRight size={14} className="ml-auto" />
                    </button>

                    <button
                      onClick={() => { setShowAddUserModal(true); setSearchResults([]); setSearchQuery(''); }}
                      className="w-full py-2.5 px-4 bg-brand hover:bg-brand-dark text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <UserPlus size={14} />
                      <span>Find Member by Name / Email</span>
                    </button>

                    <button
                      onClick={copyInviteLink}
                      className="w-full py-2 px-4 bg-white hover:bg-gray-50 text-gray-600 font-semibold rounded-2xl text-xs transition border border-gray-200 flex items-center justify-center gap-2"
                    >
                      <Copy size={13} />
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Chat Invite Link'}</span>
                    </button>
                  </div>
                </div>
              ) : filteredFriends.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No chats matching "{chatFilter}"</p>
              ) : (
                filteredFriends.map(f => {
                  const active = activeChat === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setActiveChat(f.id);
                        setActiveFriend(f);
                        setMobileView('chat');
                        setSearchParams({ user: f.id });
                      }}
                      className={`w-full p-3.5 flex items-start gap-3 transition text-left border-l-4 ${
                        active
                          ? 'bg-brand/5 border-brand'
                          : 'border-transparent hover:bg-gray-50/70'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-100 to-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200 shadow-xs">
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        {f.unreadCount && f.unreadCount > 0 ? (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                            {f.unreadCount}
                          </span>
                        ) : null}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-xs text-gray-900 truncate flex items-center gap-1.5">
                            <span className="truncate">{f.name}</span>
                          </h4>
                          {f.lastMessageTime && (
                            <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                              {formatMessageTime(f.lastMessageTime)}
                            </span>
                          )}
                        </div>

                        {/* Relationship Tag */}
                        <div className="flex items-center gap-1.5 mt-0.5 mb-1">
                          {f.relationship === 'sponsor' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              Your Sponsor
                            </span>
                          ) : f.relationship === 'referral' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Your Referral
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              Connected Contact
                            </span>
                          )}
                        </div>

                        {/* Message Preview */}
                        <p className={`text-[11px] truncate leading-tight ${
                          f.unreadCount && f.unreadCount > 0 ? 'font-bold text-gray-900' : 'text-gray-500'
                        }`}>
                          {f.lastMessage ? (
                            <span>{f.lastMessageIsMe ? 'You: ' : ''}{f.lastMessage}</span>
                          ) : (
                            <span className="italic text-gray-400">Start conversation...</span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: PEOPLE YOU KNOW (NETWORK DISCOVERY) ────────────────────── */}
        {sidebarTab === 'network' && (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            
            {/* Banner explaining network chat */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-blue-50/60 border border-indigo-100 rounded-2xl">
              <div className="flex items-start gap-2.5">
                <Users size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-indigo-950">Your Direct Investment Network</h4>
                  <p className="text-[11px] text-indigo-800/80 mt-0.5 leading-relaxed">
                    Message the person who invited you or investors you introduced. Chat 1-on-1 about yields and strategies!
                  </p>
                </div>
              </div>
            </div>

            {networkLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                <RefreshCw size={20} className="animate-spin text-brand" />
                <span className="text-xs font-medium">Loading your network...</span>
              </div>
            ) : (
              <>
            {/* 1. Upline / Sponsor Section */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-1">
                Your Sponsor / Inviter
              </span>

              {uplineContact ? (
                <div className="p-3 bg-white border border-purple-100 rounded-2xl shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shrink-0 border border-purple-200">
                      {uplineContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h5 className="font-bold text-xs text-gray-900 truncate">{uplineContact.name}</h5>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 shrink-0">
                          Sponsor
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{uplineContact.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConnectAndChat(uplineContact)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shrink-0 shadow-xs flex items-center gap-1"
                  >
                    <MessageSquare size={12} />
                    <span>Chat</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-white border border-gray-100 rounded-2xl text-center py-4 text-xs text-gray-400">
                  You joined directly without an inviter code.
                </div>
              )}
            </div>

            {/* 2. Downlines / Referrals Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  People You Introduced ({downlineContacts.length})
                </span>
              </div>

              {downlineContacts.length === 0 ? (
                <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center space-y-2">
                  <Users size={20} className="text-gray-300 mx-auto" />
                  <p className="text-xs text-gray-500 font-medium">No referrals yet</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    When people sign up with your link, they'll show up here automatically so you can chat with them.
                  </p>
                  <button
                    onClick={copyInviteLink}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 mt-1"
                  >
                    <Copy size={12} />
                    <span>Copy Your Invite Link</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {downlineContacts.map(contact => (
                    <div key={contact.id} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-200">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h5 className="font-bold text-xs text-gray-900 truncate">{contact.name}</h5>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 shrink-0">
                              Referral
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{contact.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleConnectAndChat(contact)}
                        className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition shrink-0 shadow-xs flex items-center gap-1"
                      >
                        <MessageSquare size={12} />
                        <span>Chat</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Invite Link Sharing Strip */}
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Share2 size={13} className="text-indigo-400" />
                  <span>Invite Friends to Chat</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">1-Click Share</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Send your invite link to colleagues or family so they connect with you instantly on RPM.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyInviteLink}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10"
                >
                  <Copy size={12} />
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <button
                  onClick={handleShareInvite}
                  className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <Share2 size={12} />
                  <span>Share</span>
                </button>
              </div>
            </div>
            </>
            )}

          </div>
        )}

        {/* ── TAB 3: SUPPORT DESK SUMMARY TILE ──────────────────────────────── */}
        {sidebarTab === 'support' && (
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <div className="p-4 bg-slate-900 text-white rounded-3xl space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                    <MessageSquare size={14} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs flex items-center gap-1">
                      <span>RPM Official Support</span>
                      <CheckCircle2 size={12} className="text-blue-400" />
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      24/7 Live Concierge
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Direct executive desk for deposit verifications, staking yields, and property contracts.
              </p>

              <button
                onClick={() => {
                  setActiveChat('support');
                  setMobileView('chat');
                  setSearchParams({ tab: 'support' });
                }}
                className="w-full py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Open Live Support Desk</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl text-xs text-emerald-900 space-y-1">
              <strong className="font-bold block">Need immediate account help?</strong>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                All messages here are routed with priority to official compliance and finance officers.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── CENTER / RIGHT: CHAT DISPLAY PANE ──────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white ${
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* If no chat is active, show welcome & discovery screen */}
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/40">
            <div className="max-w-md w-full p-8 bg-white border border-gray-200/80 rounded-3xl shadow-sm space-y-5">
              <div className="w-16 h-16 bg-gradient-to-tr from-brand/10 to-indigo-100 text-brand rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <MessageCircle size={32} className="text-brand" />
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Your Personal Messenger</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Connect and chat with people you know directly on RPM. Share investment ideas, discuss staking earnings, or contact executive support.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => setSidebarTab('network')}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-2xl text-xs font-bold transition text-left border border-indigo-200/60 flex items-center gap-2.5"
                >
                  <Users size={18} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-extrabold">Network ({totalNetworkCount})</div>
                    <div className="text-[10px] text-indigo-700 font-normal">Sponsor & referrals</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveChat('support');
                    setSidebarTab('support');
                    setSearchParams({ tab: 'support' });
                  }}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 rounded-2xl text-xs font-bold transition text-left border border-emerald-200/60 flex items-center gap-2.5"
                >
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-extrabold">Support Desk</div>
                    <div className="text-[10px] text-emerald-700 font-normal">24/7 Live Desk</div>
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Have friends outside RPM?</span>
                <button onClick={handleShareInvite} className="font-bold text-brand hover:underline flex items-center gap-1">
                  <Share2 size={12} /> Invite them
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Pane Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-2 text-white shrink-0 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 md:hidden shrink-0"
                  title="Back to conversation list"
                >
                  <ArrowLeft size={17} />
                </button>

                {activeChat === 'support' ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-tr from-brand to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 ring-2 ring-emerald-500/20">
                      <MessageSquare size={18} />
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
                    <div className="w-10 h-10 bg-white/10 text-white rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border border-white/10">
                      {activeFriend?.name.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="font-bold text-sm truncate">{activeFriend?.name}</h1>
                        {activeFriend?.relationship === 'sponsor' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/30 text-purple-200 border border-purple-400/30 shrink-0">
                            Your Sponsor
                          </span>
                        ) : activeFriend?.relationship === 'referral' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 shrink-0">
                            Your Referral
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/30 text-blue-200 border border-blue-400/30 shrink-0">
                            Connection
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-300 truncate mt-0.5">
                        {activeFriend?.email || 'Direct 1-on-1 Encrypted Channel'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Push Alerts for Support */}
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
              
              {/* Direct Chat Privacy & Relationship Card */}
              {activeChat !== 'support' && activeFriend && (
                <div className="max-w-md mx-auto bg-white border border-gray-200/80 rounded-2xl p-3.5 text-center shadow-xs space-y-1 mb-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-1">
                    <Lock size={14} />
                  </div>
                  <h4 className="font-bold text-xs text-gray-900">
                    Direct conversation with {activeFriend.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    This is a private 1-on-1 channel. Only you and {activeFriend.name} can view these messages.
                  </p>
                </div>
              )}

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
                placeholder={activeChat === 'support' ? "Type message to support desk..." : `Message ${activeFriend?.name || 'contact'}...`}
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
          </>
        )}
      </div>

      {/* ── MODAL: FIND & ADD USERS (PEOPLE YOU KNOW) ─────────────────────── */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-brand" />
                <h3 className="font-bold text-gray-900 text-base">Connect with People You Know</h3>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>

            {/* Quick Network Suggestions Strip */}
            {totalNetworkCount > 0 && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
                  Quick Connect from Your Network
                </span>
                <div className="space-y-1.5">
                  {uplineContact && (
                    <div className="p-2 bg-white rounded-xl flex items-center justify-between gap-2 border border-indigo-100/60 shadow-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {uplineContact.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{uplineContact.name} (Sponsor)</p>
                          <p className="text-[10px] text-gray-400 truncate">{uplineContact.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowAddUserModal(false); handleConnectAndChat(uplineContact); }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold"
                      >
                        Chat
                      </button>
                    </div>
                  )}

                  {downlineContacts.slice(0, 2).map(contact => (
                    <div key={contact.id} className="p-2 bg-white rounded-xl flex items-center justify-between gap-2 border border-indigo-100/60 shadow-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {contact.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{contact.name} (Referral)</p>
                          <p className="text-[10px] text-gray-400 truncate">{contact.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowAddUserModal(false); handleConnectAndChat(contact); }}
                        className="px-2.5 py-1 bg-brand hover:bg-brand-dark text-white rounded-lg text-[11px] font-bold"
                      >
                        Chat
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anti-Spam Guidelines */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-bold text-amber-950 block">COMMUNITY GUIDELINES:</strong>
                Please only connect with colleagues, acquaintances, or partners you know. Unsolicited messaging or harassment results in immediate account suspension.
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
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
              <button
                onClick={handleSearchUsers}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-xs transition disabled:opacity-60 shrink-0"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 space-y-1">
              {searchResults.length === 0 && searchQuery && !searching && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-gray-400">No registered members found with that query.</p>
                  <p className="text-[11px] text-gray-500">Not registered yet? Share your invite link so they can join and chat with you.</p>
                  <button
                    onClick={copyInviteLink}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                  >
                    Copy Chat Invite Link
                  </button>
                </div>
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

      {/* ── MODAL: PENDING CONNECTION REQUESTS ────────────────────────────── */}
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
              <p className="text-xs text-gray-400 text-center py-6">No pending connection requests.</p>
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
    </div>
  );
}
