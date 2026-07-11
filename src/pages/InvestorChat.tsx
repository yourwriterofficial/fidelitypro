import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { 
  Send, Users, Pin, VolumeX, ShieldAlert, ShieldCheck, 
  Bell, X, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { notifyUser, sendEmailToUser } from '../lib/notify';

interface InvestorChatMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_country: string;
  body: string;
  is_pinned: boolean;
  reply_to_id: string | null;
  created_at: string;
  // UI helper for replies
  reply_to_name?: string;
  reply_to_body?: string;
}

interface BannedUser {
  id: string;
  user_name: string;
  admin_id: string | null;
  created_at: string;
}

interface FollowedUser {
  id: string;
  admin_id: string;
  target_name: string;
  created_at: string;
}

// Highly realistic investor names & countries
const SIMULATED_USERS = [
  { name: 'Alex_VIP', country: 'US' },
  { name: 'Sarah_Crypto', country: 'GB' },
  { name: 'Dmitri_M', country: 'DE' },
  { name: 'Elena_Dubai', country: 'AE' },
  { name: 'Yuki_J', country: 'JP' },
  { name: 'Sanjay_S', country: 'IN' },
  { name: 'Elena_RU', country: 'RU' },
  { name: 'InvestMaster', country: 'CA' },
  { name: 'PropKing_7', country: 'US' },
  { name: 'Pedro_Investor', country: 'BR' },
  { name: 'Zainab_Nig', country: 'NG' },
  { name: 'Johan_SA', country: 'ZA' },
  { name: 'David_Aussie', country: 'AU' },
  { name: 'Li_Wei', country: 'SG' },
  { name: 'StakingLord', country: 'GB' },
  { name: 'YieldFarmer', country: 'CH' },
  { name: 'MacroTrader', country: 'FR' },
  { name: 'RealEstateGuru', country: 'US' },
  { name: 'PassiveIncome_1', country: 'NZ' },
  { name: 'AlphaSeeker', country: 'HK' }
];

// Realistic country flag mapper
const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', AE: '🇦🇪', JP: '🇯🇵',
  IN: '🇮🇳', RU: '🇷🇺', CA: '🇨🇦', BR: '🇧🇷', NG: '🇳🇬',
  ZA: '🇿🇦', AU: '🇦🇺', SG: '🇸🇬', CH: '🇨🇭', FR: '🇫🇷',
  NZ: '🇳🇿', HK: '🇭🇰', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱'
};

// Rich simulated conversation templates
const SIMULATED_TEMPLATES = [
  "Which real estate listing has the highest dividend yield right now? Thinking of the luxury condos.",
  "Just staked $10,000 in the Professional Staking Plan. The 2.5% daily return is unbeatable.",
  "Withdrawals are lightning fast today! Got my $2,300 USDT confirmed in under 12 minutes.",
  "Is anyone else investing in the commercial properties? Listing #3 looks promising.",
  "Highly recommend setting up Google 2FA under settings. Security first, guys.",
  "Can anyone tag the @admin? I have a question about my clearance fee limit.",
  "No issues here. Staked and withdrew twice this week. Platform is fully responsive.",
  "What is the minimum deposit for the VIP plan? Is it still $50,000?",
  "Love how clean the dashboard looks. The new transaction history page is extremely useful.",
  "Staking yield payout just hit my wallet balance. Reinvesting 100% of it.",
  "Shout out to support, they answered my ticket in less than 5 minutes.",
  "Anyone investing from Europe? Germany here. Deposits via SEPA/Crypto work flawlessly.",
  "Just registered two devices for push alerts. Love getting instant staking updates.",
  "Does anyone know when the next real estate listings are dropping?",
  "Getting 2.5% daily on VIP. Staking is definitely the most stable passive flow here.",
  "The referral program is paying out nicely. Already got 3 commissions this week.",
  "Staking VIP plan is active! Looking forward to the 30-day payout.",
  "Fastest withdrawal I've ever experienced in the crypto space. Thanks RPM.",
  "Listing #7 is almost fully funded. Glad I got my down payment in yesterday.",
  "Topped up my wallet via Bitcoin. 1 block confirmation and it was instantly credited.",
  "We are growing fast, almost 1.8M active investors online today. Massive scale.",
  "Anyone using the automated compound staking? Let me know how it goes."
];

// Helper to generate consistent avatars
const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-orange-600',
  'from-red-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600'
];

export default function InvestorChat() {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<InvestorChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time dynamic user count
  const [onlineCount, setOnlineCount] = useState(1538920);

  // Telegram-like Pinned Message
  const [pinnedMessage, setPinnedMessage] = useState<InvestorChatMessage | null>(null);

  // Impersonation state (Admin only)
  const [impersonatedUser, setImpersonatedUser] = useState<{ name: string; country: string } | null>(null);
  
  // Banned users state (synced with DB)
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  
  // Followed users state (Admin only, synced with DB)
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Reply target message state
  const [replyTarget, setReplyTarget] = useState<InvestorChatMessage | null>(null);

  // Scroll details for virtual scrollback
  const [virtualHistoryCount, setVirtualHistoryCount] = useState(40);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Generate dynamic online count fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const offset = Math.floor(Math.random() * 501) - 250; // -250 to +250
        const nextVal = prev + offset;
        return Math.max(1000000, Math.min(2000000, nextVal));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial db entries and setup real-time channels
  useEffect(() => {
    fetchBannedUsers();
    fetchFollowedUsers();
    fetchInitialMessages();

    // Setup realtime subscription
    const messagesChannel = supabase
      .channel('investor_chat_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'investor_chat_messages' },
        async (payload) => {
          const newMsg = payload.new as InvestorChatMessage;
          
          // Map reply name if exists
          if (newMsg.reply_to_id) {
            const { data } = await supabase
              .from('investor_chat_messages')
              .select('sender_name, body')
              .eq('id', newMsg.reply_to_id)
              .single();
            if (data) {
              newMsg.reply_to_name = data.sender_name;
              newMsg.reply_to_body = data.body;
            }
          }

          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Check if followed user posted (Admin alert)
          if (profile?.is_admin) {
            const isFollowed = followedUsers.some(f => f.target_name.toLowerCase() === newMsg.sender_name.toLowerCase());
            if (isFollowed && newMsg.sender_id !== profile.id) {
              toast(`Followed User Alert`, {
                description: `${newMsg.sender_name} posted: "${newMsg.body.substring(0, 40)}..."`,
                action: {
                  label: "View",
                  onClick: () => {
                    const el = document.getElementById(`msg-${newMsg.id}`);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              });
              // Log local alert
              notifyUser({
                userId: profile.id,
                title: `Followed user posted`,
                message: `${newMsg.sender_name} posted a new update in Investor Chat.`,
                type: 'info',
                link: '/app/investor-chat'
              });
            }
          }

          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'investor_chat_messages' },
        (payload) => {
          const updated = payload.new as InvestorChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          if (updated.is_pinned) {
            setPinnedMessage(updated);
          } else {
            setPinnedMessage(prev => prev?.id === updated.id ? null : prev);
          }
        }
      )
      .subscribe();

    const bannedChannel = supabase
      .channel('investor_chat_bans_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investor_chat_banned' },
        () => {
          fetchBannedUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(bannedChannel);
    };
  }, [profile?.id, followedUsers]);

  const fetchBannedUsers = async () => {
    const { data } = await supabase.from('investor_chat_banned').select('*');
    setBannedUsers(data || []);
  };

  const fetchFollowedUsers = async () => {
    if (!profile?.id || !profile?.is_admin) return;
    const { data } = await supabase.from('investor_chat_follows').select('*').eq('admin_id', profile.id);
    setFollowedUsers(data || []);
  };

  const fetchInitialMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('investor_chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      let dbMsgs = data || [];
      
      // Fetch reply information for database messages
      const msgsWithReplies = await Promise.all(dbMsgs.map(async (m) => {
        if (m.reply_to_id) {
          const match = dbMsgs.find(d => d.id === m.reply_to_id);
          if (match) {
            m.reply_to_name = match.sender_name;
            m.reply_to_body = match.body;
          } else {
            const { data: replyData } = await supabase
              .from('investor_chat_messages')
              .select('sender_name, body')
              .eq('id', m.reply_to_id)
              .single();
            if (replyData) {
              m.reply_to_name = replyData.sender_name;
              m.reply_to_body = replyData.body;
            }
          }
        }
        return m;
      }));

      // If database has very few messages, seed the screen with simulated historical scrollback
      // to make it look full and premium instantly.
      setMessages(msgsWithReplies);
      const pinned = msgsWithReplies.find(m => m.is_pinned);
      if (pinned) setPinnedMessage(pinned);

      setLoading(false);
      scrollToBottom();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Generate deterministic simulated messages for scrolling history
  const virtualScrollbackMessages = useMemo(() => {
    const history: InvestorChatMessage[] = [];
    const baseTime = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
    
    for (let i = 0; i < virtualHistoryCount; i++) {
      const timeOffset = (virtualHistoryCount - i) * 8 * 60 * 1000; // ~8 mins apart
      const msgTime = new Date(baseTime + timeOffset).toISOString();
      const userIdx = (i * 7) % SIMULATED_USERS.length;
      const user = SIMULATED_USERS[userIdx];
      const templateIdx = (i * 13) % SIMULATED_TEMPLATES.length;
      const body = SIMULATED_TEMPLATES[templateIdx];
      
      history.push({
        id: `virtual-${i}`,
        sender_id: null,
        sender_name: user.name,
        sender_country: user.country,
        body,
        is_pinned: false,
        reply_to_id: null,
        created_at: msgTime
      });
    }
    return history;
  }, [virtualHistoryCount]);

  // Combine virtual scrollback history with actual database messages
  const allMessagesList = useMemo(() => {
    // Filter out any virtual messages that might have the same content as real messages for safety
    return [...virtualScrollbackMessages, ...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [virtualScrollbackMessages, messages]);

  // Simulated live message additions (local loop to make chat active in real-time)
  useEffect(() => {
    if (loading) return;

    const interval = setInterval(async () => {
      // Pick a random simulated user
      const user = SIMULATED_USERS[Math.floor(Math.random() * SIMULATED_USERS.length)];
      
      // Determine template and build message body
      let body = SIMULATED_TEMPLATES[Math.floor(Math.random() * SIMULATED_TEMPLATES.length)];
      
      // Randomly reply/mention other users to simulate flow
      const mentionProb = Math.random();
      let replyId: string | null = null;
      let replyName: string | undefined = undefined;
      let replyBody: string | undefined = undefined;

      if (mentionProb > 0.6 && allMessagesList.length > 0) {
        // Tag someone
        const prevMsg = allMessagesList[allMessagesList.length - 1];
        if (Math.random() > 0.5) {
          body = `@${prevMsg.sender_name} Yes, I agree completely. That's why I reinvested.`;
        } else {
          replyId = prevMsg.id;
          replyName = prevMsg.sender_name;
          replyBody = prevMsg.body;
          body = `That makes sense, thanks for explaining.`;
        }
      }

      const simulatedMsg: InvestorChatMessage = {
        id: `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        sender_id: null,
        sender_name: user.name,
        sender_country: user.country,
        body,
        is_pinned: false,
        reply_to_id: replyId,
        created_at: new Date().toISOString(),
        reply_to_name: replyName,
        reply_to_body: replyBody
      };

      // Set to local state so active user sees the chat rolling
      setMessages(prev => [...prev, simulatedMsg]);
      scrollToBottom();
    }, 9000); // Live chats every 9 seconds

    return () => clearInterval(interval);
  }, [loading, allMessagesList]);

  // Handle scroll to top to load more virtual history
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    if (chatContainerRef.current.scrollTop === 0 && virtualHistoryCount < 1000) {
      // Load more simulated history
      const oldScrollHeight = chatContainerRef.current.scrollHeight;
      setVirtualHistoryCount(prev => prev + 40);
      
      // Restore scroll position
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - oldScrollHeight;
        }
      }, 50);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Check if current user is banned
  const isCurrentBanned = useMemo(() => {
    if (!profile?.name) return false;
    return bannedUsers.some(b => b.user_name.toLowerCase() === profile.name.toLowerCase());
  }, [profile?.name, bannedUsers]);

  // Handle posting message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    
    if (isCurrentBanned) {
      toast.error('You are banned from sending messages in this chat.');
      return;
    }

    setSending(true);
    try {
      const senderName = impersonatedUser ? impersonatedUser.name : (profile?.name || 'Investor');
      const senderCountry = impersonatedUser ? impersonatedUser.country : 'US';

      // Insert message into DB
      const { error } = await supabase.from('investor_chat_messages').insert({
        sender_id: profile?.id || null,
        sender_name: senderName,
        sender_country: senderCountry,
        body: text.trim(),
        reply_to_id: replyTarget?.id || null,
        is_pinned: false
      }).select().single();

      if (error) throw error;

      // Extract mentions e.g. @Name
      const mentionRegex = /@(\w+)/g;
      const matches = [...text.matchAll(mentionRegex)];
      const mentionedNames = matches.map(m => m[1]);

      for (const name of mentionedNames) {
        // Query if real profile matches name
        const { data: matchedUser } = await supabase
          .from('profiles')
          .select('id, email, name')
          .ilike('name', name.replace(/_/g, ' '))
          .maybeSingle();

        if (matchedUser) {
          // Trigger Alert notification
          await notifyUser({
            userId: matchedUser.id,
            title: 'Tagged in Investor Chat',
            message: `${senderName} tagged you in the community chat: "${text.substring(0, 40)}..."`,
            type: 'info',
            link: '/app/investor-chat'
          });

          // Trigger email notification
          const emailSubject = `You were tagged in ${import.meta.env.VITE_APP_NAME || 'RPM'} Investor Chat`;
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px;">
              <h2 style="color: #111;">Hello ${matchedUser.name},</h2>
              <p style="color: #555; font-size: 14px; line-height: 1.5;">
                <strong>${senderName}</strong> mentioned/tagged you in the global Investor Group Chat.
              </p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #111; margin: 20px 0; font-style: italic; color: #333;">
                "${text}"
              </div>
              <p style="color: #555; font-size: 14px;">
                Log into your account to read the full thread and reply to the conversation.
              </p>
              <a href="${window.location.origin}/app/investor-chat" style="display: inline-block; background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
                Open Investor Chat
              </a>
            </div>
          `;
          await sendEmailToUser(matchedUser.id, 'info', emailSubject, emailBody);
        }
      }

      setText('');
      setReplyTarget(null);
      scrollToBottom();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Admin Pin Action
  const handlePinMessage = async (msg: InvestorChatMessage) => {
    if (!profile?.is_admin) return;
    try {
      // Unpin all first
      await supabase.from('investor_chat_messages').update({ is_pinned: false }).eq('is_pinned', true);
      // Pin current
      const { error } = await supabase
        .from('investor_chat_messages')
        .update({ is_pinned: true })
        .eq('id', msg.id);
      
      if (error) throw error;
      toast.success(`Message pinned!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Unpin Action
  const handleUnpinMessage = async () => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_messages').update({ is_pinned: false }).eq('is_pinned', true);
      if (error) throw error;
      setPinnedMessage(null);
      toast.success(`Pinned message dismissed.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Ban Action
  const handleBanUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_banned').insert({
        user_name: userName,
        admin_id: profile.id
      });
      if (error) throw error;
      toast.success(`User @${userName} has been banned from the chat!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to ban user');
    }
  };

  // Admin Unban Action
  const handleUnbanUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_banned').delete().eq('user_name', userName);
      if (error) throw error;
      toast.success(`User @${userName} unbanned.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Follow Action
  const handleFollowUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_follows').insert({
        admin_id: profile.id,
        target_name: userName
      });
      if (error) throw error;
      toast.success(`Following @${userName}. You will be alerted when they post.`);
      fetchFollowedUsers();
    } catch (err: any) {
      toast.error(err.message || 'Already following this user');
    }
  };

  // Admin Unfollow Action
  const handleUnfollowUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase
        .from('investor_chat_follows')
        .delete()
        .eq('admin_id', profile.id)
        .eq('target_name', userName);
      
      if (error) throw error;
      toast.success(`Stopped following @${userName}.`);
      fetchFollowedUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Get avatar gradient index based on name hash
  const getAvatarGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
  };

  // Search filtered message list
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessagesList;
    return allMessagesList.filter(m => 
      m.body.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allMessagesList, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-12 flex flex-col md:flex-row gap-6 h-[88vh]">
      
      {/* Sidebar - Settings & Stats */}
      <div className="w-full md:w-64 bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 flex flex-col justify-between shrink-0 h-fit md:h-full shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Users className="text-brand shrink-0 animate-pulse" size={20} />
            <div>
              <h2 className="font-bold text-sm">Investor Chat</h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">RPM Global Room</span>
            </div>
          </div>

          {/* Active stats */}
          <div className="space-y-4">
            <div className="bg-slate-850/50 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Live Online</span>
              <p className="text-xl font-extrabold tabular-nums text-emerald-400 mt-1">
                {onlineCount.toLocaleString()}
              </p>
              <span className="text-[9px] text-slate-400 mt-1 block">Global coverage from 195 countries</span>
            </div>
            
            <div className="bg-slate-850/50 border border-slate-850 p-4 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span>Room type</span>
                <span className="font-bold text-white">Public Group</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Message Capacity</span>
                <span className="font-bold text-white">500,000 max</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Members allowed</span>
                <span className="font-bold text-white">All Investors</span>
              </div>
            </div>
          </div>

          {/* Rules/Info */}
          <div className="space-y-2 text-xs text-slate-400">
            <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider block">Guidelines</span>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
              <li>Use `@name` to tag any active member</li>
              <li>Tagged members receive emails & push alerts</li>
              <li>Spamming or flooding will trigger automated ban</li>
            </ul>
          </div>
        </div>

        {/* Admin Dashboard Controls inside sidebar */}
        {profile?.is_admin && (
          <div className="pt-4 border-t border-slate-800 space-y-2 mt-4">
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
            >
              <ShieldCheck size={14} /> {showAdminPanel ? "Hide Admin Tools" : "Show Admin Tools"}
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden h-full">
        
        {/* Chat Header */}
        <div className="p-4 bg-gray-50/75 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gray-900/5 text-gray-900 flex items-center justify-center font-extrabold text-base border">
              #
            </div>
            <div>
              <h3 className="font-extrabold text-gray-950 text-sm">RPM Group Room</h3>
              <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                {onlineCount.toLocaleString()} Active members online
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat feed..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Telegram Pinned Message Banner */}
        {pinnedMessage && (
          <div className="bg-amber-50 border-b border-amber-100/50 px-4 py-2 text-xs flex items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2 min-w-0">
              <Pin size={13} className="text-amber-600 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold block text-[10px] text-amber-700 uppercase tracking-wider">Pinned Message</span>
                <p className="truncate font-semibold text-amber-950">{pinnedMessage.sender_name}: {pinnedMessage.body}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  const el = document.getElementById(`msg-${pinnedMessage.id}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[10px] text-brand hover:underline font-bold px-2 py-0.5 rounded bg-amber-200/50"
              >
                View
              </button>
              {profile?.is_admin && (
                <button onClick={handleUnpinMessage} className="text-amber-500 hover:text-amber-700 p-1 rounded-lg">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages feed */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 bg-gray-50/20"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Users className="animate-pulse text-gray-300" size={32} />
              <p className="text-xs text-gray-400 font-semibold">Connecting to group network...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16 text-gray-400 space-y-2">
              <Search size={32} className="mx-auto text-gray-200" />
              <p className="font-bold text-gray-700 text-xs">No matching messages found</p>
            </div>
          ) : (
            <>
              {/* Infinite simulated scrolling header indicator */}
              {virtualHistoryCount < 1000 && (
                <div className="text-center text-[10px] text-gray-400 py-2 select-none border-b border-gray-100 bg-gray-50/30 rounded-xl">
                  Scroll up to load historical group feed (Simulating up to 500,000 messages)
                </div>
              )}

              {filteredMessages.map((msg) => {
                const isRealSender = msg.sender_id !== null;
                const flag = COUNTRY_FLAGS[msg.sender_country] || '🌐';
                const isFollowed = followedUsers.some(f => f.target_name.toLowerCase() === msg.sender_name.toLowerCase());

                return (
                  <div 
                    key={msg.id} 
                    id={`msg-${msg.id}`}
                    className={`flex items-start gap-3 group relative rounded-2xl p-2.5 transition hover:bg-gray-100/50 ${
                      msg.is_pinned ? 'bg-amber-50/40 border border-amber-100/50' : ''
                    }`}
                  >
                    {/* User Avatar */}
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(msg.sender_name)} text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm`}>
                      {msg.sender_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Sender details */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900 text-xs hover:underline cursor-pointer">
                          @{msg.sender_name}
                        </span>
                        <span className="text-xs" title={`Country code: ${msg.sender_country}`}>
                          {flag}
                        </span>
                        {isRealSender && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 border rounded-md text-[8px] font-bold">
                            Verified
                          </span>
                        )}
                        {isFollowed && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[8px] font-bold flex items-center gap-0.5">
                            <Bell size={8} /> Following
                          </span>
                        )}
                        <span className="text-[9px] text-gray-400 font-semibold tabular-nums ml-auto shrink-0">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Reply Target Info */}
                      {msg.reply_to_name && (
                        <div className="mt-1.5 pl-2.5 border-l-2 border-brand/40 bg-gray-50 py-1 rounded text-[11px] text-gray-500 leading-snug">
                          <span className="font-bold text-gray-700 block">Reply to @{msg.reply_to_name}</span>
                          <p className="truncate text-gray-400">{msg.reply_to_body}</p>
                        </div>
                      )}

                      {/* Message Content */}
                      <p className="text-xs text-gray-800 leading-relaxed font-medium mt-1 select-text">
                        {msg.body}
                      </p>
                    </div>

                    {/* Telegram context Menu (Hover action overlay) */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white border border-gray-150 p-1 rounded-xl shadow-md transition">
                      <button
                        onClick={() => setReplyTarget(msg)}
                        className="p-1 hover:bg-gray-50 rounded-lg text-gray-500 text-[10px] font-bold px-1.5 flex items-center gap-0.5"
                        title="Reply to message"
                      >
                        Reply
                      </button>

                      {profile?.is_admin && (
                        <>
                          <button
                            onClick={() => handlePinMessage(msg)}
                            className="p-1 hover:bg-gray-50 rounded-lg text-amber-500"
                            title="Pin message"
                          >
                            <Pin size={12} />
                          </button>
                          
                          {isFollowed ? (
                            <button
                              onClick={() => handleUnfollowUser(msg.sender_name)}
                              className="p-1 hover:bg-gray-50 rounded-lg text-blue-500"
                              title="Stop following posts"
                            >
                              <VolumeX size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollowUser(msg.sender_name)}
                              className="p-1 hover:bg-gray-50 rounded-lg text-blue-500"
                              title="Follow user posts"
                            >
                              <Bell size={12} />
                            </button>
                          )}

                          <button
                            onClick={() => setImpersonatedUser({ name: msg.sender_name, country: msg.sender_country })}
                            className="p-1 hover:bg-gray-50 rounded-lg text-purple-500 text-[10px] font-bold px-1.5"
                            title="Impersonate user"
                          >
                            Impersonate
                          </button>

                          <button
                            onClick={() => handleBanUser(msg.sender_name)}
                            className="p-1 hover:bg-red-50 rounded-lg text-red-500"
                            title="Ban user"
                          >
                            <ShieldAlert size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Impersonation Overlay Banner (Admin only) */}
        {impersonatedUser && (
          <div className="bg-purple-50 border-t border-purple-100 px-4 py-2.5 text-xs text-purple-900 flex justify-between items-center gap-3">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-purple-600 shrink-0" />
              Writing mode: Impersonating <span className="font-bold text-purple-950">@{impersonatedUser.name}</span> ({COUNTRY_FLAGS[impersonatedUser.country] || impersonatedUser.country})
            </span>
            <button
              onClick={() => setImpersonatedUser(null)}
              className="text-[10px] text-purple-600 font-bold hover:underline bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-lg"
            >
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Reply Target indicator */}
        {replyTarget && (
          <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 text-xs flex justify-between items-center gap-3 text-gray-600">
            <span className="truncate">
              Replying to <span className="font-bold">@{replyTarget.sender_name}</span>: <i>"{replyTarget.body}"</i>
            </span>
            <button onClick={() => setReplyTarget(null)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Chat input box */}
        <div className="p-4 border-t border-gray-100 bg-white">
          {isCurrentBanned ? (
            <div className="bg-red-50 text-red-650 border border-red-150 rounded-2xl p-4 flex items-center justify-center gap-3 text-sm font-semibold select-none">
              <ShieldAlert size={20} className="shrink-0" />
              <span>You have been banned from posting in the global investor chat by the admin.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-3 items-center">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={
                  replyTarget 
                    ? `Reply to @${replyTarget.sender_name}...` 
                    : impersonatedUser 
                      ? `Type as @${impersonatedUser.name}...` 
                      : "Type your comment here (use @name to tag)..."
                }
                className="flex-1 border border-gray-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none bg-white"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 text-white rounded-2xl p-3.5 transition shadow-sm hover:shadow-md shrink-0 flex items-center justify-center disabled:text-gray-400"
              >
                <Send size={15} />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Admin Sliding Modal Panel */}
      {showAdminPanel && profile?.is_admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdminPanel(false)} />
          <div className="bg-white max-w-sm w-full h-[90vh] rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-950 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <ShieldCheck size={18} /> Chat Administration Panel
              </h3>
              <button onClick={() => setShowAdminPanel(false)} className="p-1 hover:bg-gray-800 rounded-xl transition text-white">
                <X size={18} />
              </button>
            </div>

            {/* Scrolling list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 bg-gray-50/50">
              
              {/* Custom Impersonate config */}
              <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="font-bold text-xs text-gray-900">Custom Impersonation Creator</h4>
                <p className="text-[10px] text-gray-450">Create a temporary custom name/country to post as.</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter custom username..."
                    id="imp-name"
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none"
                  />
                  <select 
                    id="imp-country"
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none"
                  >
                    {Object.keys(COUNTRY_FLAGS).map(k => (
                      <option key={k} value={k}>{COUNTRY_FLAGS[k]} {k}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const name = (document.getElementById('imp-name') as HTMLInputElement)?.value;
                      const country = (document.getElementById('imp-country') as HTMLSelectElement)?.value;
                      if (!name) return toast.error("Enter a valid name");
                      setImpersonatedUser({ name, country });
                      toast.success(`Impersonation active for @${name}`);
                    }}
                    className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold transition hover:bg-gray-800"
                  >
                    Apply Custom Impersonator
                  </button>
                </div>
              </div>

              {/* Followed Users list */}
              <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="font-bold text-xs text-gray-900 flex items-center justify-between">
                  <span>Followed Users ({followedUsers.length})</span>
                </h4>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {followedUsers.length === 0 ? (
                    <p className="text-[10px] text-gray-400 py-4 text-center">Not following any users yet.</p>
                  ) : (
                    followedUsers.map(f => (
                      <div key={f.id} className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
                        <span className="font-bold">@{f.target_name}</span>
                        <button
                          onClick={() => handleUnfollowUser(f.target_name)}
                          className="text-[10px] text-red-500 hover:underline font-bold"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Banned Users list */}
              <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="font-bold text-xs text-gray-900">Banned Accounts ({bannedUsers.length})</h4>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {bannedUsers.length === 0 ? (
                    <p className="text-[10px] text-gray-400 py-4 text-center">No banned members yet.</p>
                  ) : (
                    bannedUsers.map(b => (
                      <div key={b.id} className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
                        <span className="font-bold text-red-650">@{b.user_name}</span>
                        <button
                          onClick={() => handleUnbanUser(b.user_name)}
                          className="text-[10px] text-emerald-600 hover:underline font-bold"
                        >
                          Unban/Forgive
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
