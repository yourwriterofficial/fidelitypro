import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Ban, UserCheck, Eye, Edit, Plus, Minus, Save, X, Mail, Lock, Key, Check, CheckCheck, Trash2, Bell, BellRing, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { sendEmailAndLog, notifyUser } from '../../lib/notify';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
  is_admin: boolean;
  banned: boolean;
  ban_reason: string;
  can_withdraw: boolean;
  can_invest: boolean;
  can_stake: boolean;
  can_property: boolean;
  restriction_reason: string;
  fee_required: number;
  created_at: string;
  last_seen?: string;
}

interface Investment {
  id: string;
  product_name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface StakingOrder {
  id: string;
  amount: number;
  apy: number;
  lock_days: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface PropertyInvestment {
  id: string;
  property_title: string;
  amount_paid: number;
  remaining_balance: number;
  status: string;
  term_months?: number;
  monthly_payment?: number;
  property?: {
    title: string;
    price: number;
  };
}

export default function AdminUsers() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  interface OnlineUser {
    user_id: string;
    name: string;
    email: string;
    current_page: string;
    last_active: string;
  }
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [watchedUserIds, setWatchedUserIds] = useState<Set<string>>(new Set());
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [visitorHistory, setVisitorHistory] = useState<Record<string, { path: string; created_at: string }[]>>({});
  const [loadingHistoryFor, setLoadingHistoryFor] = useState<string | null>(null);
  const previousOnlineIdsRef = useRef<Set<string>>(new Set());
  const lastAlertedAtRef = useRef<Record<string, number>>({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Real-time Chat Tab inside User Modal
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [topupAmount, setTopupAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stakingOrders, setStakingOrders] = useState<StakingOrder[]>([]);
  const [propertyInvestments, setPropertyInvestments] = useState<PropertyInvestment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const navigate = useNavigate();

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Create new user states
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserBalance, setNewUserBalance] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

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

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m === 0 ? `${s}s` : `${m}m ${s}s`;
  };

  // Keep a ref mirror of watchedUserIds so the presence handler (set up once)
  // always reads the latest watch list without needing to resubscribe.
  const watchedUserIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    watchedUserIdsRef.current = watchedUserIds;
  }, [watchedUserIds]);

  const fetchWatchedUsers = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('admin_watched_users').select('target_user_id').eq('admin_id', user.id);
    setWatchedUserIds(new Set((data || []).map((r: any) => r.target_user_id)));
  };

  const toggleWatch = async (targetUserId: string, targetName: string) => {
    if (!user?.id) return;
    const isWatching = watchedUserIds.has(targetUserId);
    try {
      if (isWatching) {
        await supabase.from('admin_watched_users').delete().eq('admin_id', user.id).eq('target_user_id', targetUserId);
        setWatchedUserIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        toast.success(`Stopped watching ${targetName}`);
      } else {
        await supabase.from('admin_watched_users').insert({ admin_id: user.id, target_user_id: targetUserId });
        setWatchedUserIds(prev => new Set(prev).add(targetUserId));
        toast.success(`Watching ${targetName} — you'll be alerted when they come online`);
      }
    } catch (err: any) {
      toast.error('Failed to update watch: ' + err.message);
    }
  };

  const fetchVisitHistory = async (userId: string) => {
    setLoadingHistoryFor(userId);
    try {
      const { data } = await supabase
        .from('user_page_visits')
        .select('path, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      setVisitorHistory(prev => ({ ...prev, [userId]: data || [] }));
    } finally {
      setLoadingHistoryFor(null);
    }
  };

  const expandedVisitorIdRef = useRef<string | null>(null);
  useEffect(() => {
    expandedVisitorIdRef.current = expandedVisitorId;
  }, [expandedVisitorId]);

  const toggleVisitorExpanded = (userId: string) => {
    if (expandedVisitorId === userId) {
      setExpandedVisitorId(null);
      return;
    }
    setExpandedVisitorId(userId);
    fetchVisitHistory(userId);
  };

  useEffect(() => {
    fetchUsers();
    fetchTemplates();
    fetchWatchedUsers();

    // 1. Subscribe to presence tracking channel
    const presenceChannel = supabase.channel('online_users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const list: OnlineUser[] = [];
        Object.keys(state).forEach((key) => {
          const presenceList = state[key] as any[];
          if (presenceList && presenceList.length > 0) {
            // Prefer the most recently active entry rather than assuming
            // index 0 — presence.track() can leave more than one entry
            // under the same key (see the note on the equivalent code in
            // Layout.tsx), and current_page here is only used as an initial
            // fallback anyway; the realtime_page_visits subscription below
            // is what actually keeps it live.
            const latest = presenceList.reduce((a: any, b: any) =>
              new Date(b.last_active || 0).getTime() > new Date(a.last_active || 0).getTime() ? b : a
            );
            list.push({
              user_id: key,
              name: latest.name || 'User',
              email: latest.email || '',
              current_page: latest.current_page || '',
              last_active: latest.last_active || '',
            });
          }
        });
        setOnlineUsers(prev => list.map(u => {
          // Carry forward a fresher current_page already learned from the
          // page-visits feed if presence's own snapshot is older.
          const existing = prev.find(p => p.user_id === u.user_id);
          return existing && new Date(existing.last_active) > new Date(u.last_active || 0)
            ? { ...u, current_page: existing.current_page, last_active: existing.last_active }
            : u;
        }));

        // Detect users who just transitioned offline -> online and alert any
        // admin watching them (push + in-app + toast). A 5-minute per-user
        // cooldown absorbs brief presence flicker from page navigation so a
        // watched user browsing around doesn't spam repeat alerts.
        const newOnlineIds = new Set(list.map(l => l.user_id));
        const prevOnlineIds = previousOnlineIdsRef.current;
        const watched = watchedUserIdsRef.current;
        const now = Date.now();
        list.forEach(ou => {
          if (prevOnlineIds.has(ou.user_id)) return;
          if (!watched.has(ou.user_id)) return;
          const lastAlerted = lastAlertedAtRef.current[ou.user_id] || 0;
          if (now - lastAlerted < 5 * 60 * 1000) return;
          lastAlertedAtRef.current[ou.user_id] = now;

          const displayName = ou.name || ou.email || 'A watched user';
          toast(`${displayName} just came online`, {
            description: `Now viewing ${ou.current_page || 'the site'}`,
          });
          if (user?.id) {
            notifyUser({
              userId: user.id,
              title: 'Watched user online',
              message: `${displayName} just came online (viewing ${ou.current_page || 'the site'}).`,
              type: 'alert',
              link: '/admin/users',
            });
          }
        });
        previousOnlineIdsRef.current = newOnlineIds;
      })
      .subscribe();

    // 2. Live-refresh current_page for every online visitor the moment they
    // navigate, and refresh the expanded visitor's page history too. This
    // (not presence.track(), which only reflects the page a connection
    // opened on) is what makes "Viewing: X" update in real time.
    const visitsChannel = supabase
      .channel('realtime_page_visits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_page_visits' }, (payload: any) => {
        const visitedUserId = payload.new?.user_id;
        if (!visitedUserId) return;
        setOnlineUsers(prev => prev.map(u =>
          u.user_id === visitedUserId
            ? { ...u, current_page: payload.new.path, last_active: payload.new.created_at }
            : u
        ));
        if (visitedUserId === expandedVisitorIdRef.current) {
          fetchVisitHistory(visitedUserId);
        }
      })
      .subscribe();

    // 3. Subscribe to profiles changes to track last_seen updates instantly
    const profilesChannel = supabase
      .channel('profiles_realtime_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as User;
        setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(visitsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user?.id]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('email_templates').select('*');
    setEmailTemplates(data || []);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setEmailSubject('');
      setEmailMessage('');
      return;
    }
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setEmailSubject(template.subject || '');
      let body = template.body_html || template.body_text || '';
      // Replace template variables
      body = body
        .replace(/{{name}}/g, selectedUser?.name || 'User')
        .replace(/{{site_url}}/g, window.location.origin)
        .replace(/{{amount}}/g, '$100.00')
        .replace(/{{plan_name}}/g, 'Premium Plan')
        .replace(/{{daily_return}}/g, '2.5')
        .replace(/{{duration_days}}/g, '30')
        .replace(/{{address}}/g, '0x1234567890abcdef...');
      setEmailMessage(body);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error('Name, email and password are required');
      return;
    }
    setCreatingUser(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          full_name: newUserName,
          ref_code: null,
        }),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch (err) {
        console.warn('Response was not JSON:', err);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `Signup failed (${response.status})`);
      }

      const newUserId = result.user?.id;
      if (newUserId && newUserBalance) {
        const balanceVal = parseFloat(newUserBalance);
        if (!isNaN(balanceVal) && balanceVal > 0) {
          await supabase.rpc('add_wallet_balance', { user_id: newUserId, amount: balanceVal });
          await supabase.from('transactions').insert({
            user_id: newUserId,
            type: 'admin',
            amount: balanceVal,
            description: 'Initial wallet balance credit',
            status: 'completed',
          });
        }
      }

      toast.success('User created successfully');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserBalance('');
      setNewUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load users');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    setEditData({
      name: user.name,
      email: user.email,
      is_admin: user.is_admin,
      banned: user.banned,
      ban_reason: user.ban_reason,
      can_withdraw: user.can_withdraw,
      can_invest: user.can_invest,
      can_stake: user.can_stake,
      can_property: user.can_property,
      restriction_reason: user.restriction_reason || '',
      fee_required: user.fee_required || 0,
    });
    setTopupAmount('');
    setDeductAmount('');
    setActiveTab('profile');
    setModalOpen(true);
    await fetchUserDetails(user.id);
  };

  const fetchUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const { data: invData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setInvestments(invData || []);

      const { data: stakingData } = await supabase
        .from('staking_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setStakingOrders(stakingData || []);

      const { data: propData } = await supabase
        .from('property_investments')
        .select('*, property:property_id(title, price)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPropertyInvestments(propData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchChatMessages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setChatMessages(data || []);
      
      // Mark read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('sender_id', userId)
        .eq('read', false);
        
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error loading user chat:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to permanently delete this message?')) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      toast.success('Message deleted');
      setChatMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message');
    }
  };

  const sendModalChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser?.id || !chatText.trim() || !user?.id || sendingChat) return;
    setSendingChat(true);
    const textToSend = chatText.trim();
    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          user_id: selectedUser.id,
          sender_id: user.id,
          body: textToSend,
          read: false
        })
        .select()
        .single();

      if (error) throw error;
      setChatText('');
      setChatMessages(prev => [...prev, newMsg]);
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Trigger push notification to user
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: [selectedUser.id],
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
          user_id: selectedUser.id,
          title: 'New Support Message',
          message: `Support: "${textToSend.substring(0, 40)}${textToSend.length > 40 ? '...' : ''}"`,
          type: 'info',
          link: '/app/chat',
          read: false
        });
      } catch (notifErr) {
        console.warn('Failed to insert user notification:', notifErr);
      }

      // Send email alert to user
      if (selectedUser.email) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: selectedUser.email,
              subject: 'New message from RPM Support',
              html: `
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
            }
          });
        } catch (emailErr) {
          console.warn('Email notify to user failed:', emailErr);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingChat(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && selectedUser?.id) {
      fetchChatMessages(selectedUser.id);

      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
      }

      chatChannelRef.current = supabase
        .channel(`admin_user_modal_chat:${selectedUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${selectedUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new;
              setChatMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              
              setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);

              // Mark read if it came from the user
              if (newMsg.sender_id === selectedUser.id) {
                supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('user_id', selectedUser.id)
                  .eq('sender_id', selectedUser.id)
                  .eq('read', false)
                  .then();
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new;
              setChatMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
            }
          }
        )
        .subscribe();
    } else {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    }

    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
      }
    };
  }, [activeTab, selectedUser?.id]);

  const saveProfile = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editData.name,
          is_admin: editData.is_admin,
          banned: editData.banned,
          ban_reason: editData.ban_reason,
          can_withdraw: editData.can_withdraw,
          can_invest: editData.can_invest,
          can_stake: editData.can_stake,
          can_property: editData.can_property,
          restriction_reason: editData.restriction_reason,
          fee_required: editData.fee_required,
        })
        .eq('id', selectedUser.id);
      if (error) throw error;
      toast.success('Profile updated');
      fetchUsers();
      setSelectedUser({ ...selectedUser, ...editData });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTopup = async () => {
    if (!selectedUser) return;
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await supabase.rpc('add_wallet_balance', { user_id: selectedUser.id, amount });
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        type: 'admin',
        amount,
        description: 'Admin wallet top-up',
        status: 'completed',
      });
      toast.success(`Added $${amount} to wallet`);
      setTopupAmount('');

      // Automatically clear restrictions if top-up amount satisfies fee_required
      const fee = selectedUser.fee_required || 0;
      if (fee > 0 && amount >= fee) {
        const { error: profileErr } = await supabase.from('profiles').update({
          fee_required: 0,
          can_invest: true,
          can_withdraw: true,
          can_stake: true,
          can_property: true,
          restriction_reason: '',
        }).eq('id', selectedUser.id);
        if (profileErr) console.error('Error clearing profile restrictions:', profileErr);
        else toast.success('Account restrictions cleared successfully');
      }

      await fetchUsers();
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeduct = async () => {
    if (!selectedUser) return;
    const amount = parseFloat(deductAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (selectedUser.wallet_balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: selectedUser.id, amount });
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        type: 'admin',
        amount: -amount,
        description: 'Admin wallet deduction',
        status: 'completed',
      });
      toast.success(`Deducted $${amount} from wallet`);
      setDeductAmount('');
      await fetchUsers();
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const sendEmail = async () => {
    if (!selectedUser) return;
    if (!emailSubject || !emailMessage) {
      toast.error('Subject and message required');
      return;
    }
    setSendingEmail(true);
    try {
      const { error } = await sendEmailAndLog(
        selectedUser.email,
        emailSubject,
        `<p>${emailMessage.replace(/\n/g, '<br>')}</p>`
      );
      if (error) throw error;
      toast.success('Email sent');
      setEmailSubject('');
      setEmailMessage('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;
    try {
      toast.loading('Generating password reset link...', { id: 'reset-pwd' });
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: {
          action: 'reset-password',
          email: selectedUser.email,
          redirectTo: `${window.location.origin}/reset-password`
        }
      });
      if (error) throw error;
      if (data?.link) {
        await navigator.clipboard.writeText(data.link);
        toast.success('Reset link copied to clipboard!', { id: 'reset-pwd' });
      } else {
        toast.success('Reset email instructions sent!', { id: 'reset-pwd' });
      }
    } catch (err: any) {
      toast.error('Failed to reset password: ' + err.message, { id: 'reset-pwd' });
    }
  };

  const generateMagicLink = async () => {
    if (!selectedUser) return;
    try {
      toast.loading('Generating magic link...', { id: 'magic-link' });
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: {
          action: 'magic-link',
          email: selectedUser.email,
          redirectTo: `${window.location.origin}/app`
        }
      });
      if (error) throw error;
      if (data?.link) {
        await navigator.clipboard.writeText(data.link);
        toast.success('Magic link copied to clipboard!', { id: 'magic-link' });
      } else {
        toast.success('Magic link generated!', { id: 'magic-link' });
      }
    } catch (err: any) {
      toast.error('Failed to generate magic link: ' + err.message, { id: 'magic-link' });
    }
  };

  // Build a readable but strong temporary password (letters + digits, no
  // ambiguous chars) that an admin can hand to a user to log in with right away.
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const rand = new Uint32Array(10);
    crypto.getRandomValues(rand);
    for (let i = 0; i < 10; i++) out += chars[rand[i] % chars.length];
    // Guarantee it clears Supabase's 6-char minimum and reads as a temp pass.
    return `Rpm-${out}`;
  };

  const buildTempPasswordEmail = (name: string, email: string, pwd: string) => `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
        <div style="background-color: #0f172a; padding: 32px; text-align: center;">
          <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
        </div>
        <div style="padding: 40px 32px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">A temporary password was set for your account, ${name}</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Our support team has set a temporary password for your account so you can get back in right away. Use the credentials below to log in, then change your password from Settings.</p>
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;">Username / Email</p>
            <p style="font-size: 15px; color: #111827; margin: 0 0 16px 0; font-weight: 600;">${email}</p>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;">Temporary Password</p>
            <p style="font-size: 18px; color: #111827; margin: 0; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 0.02em;">${pwd}</p>
          </div>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${window.location.origin}/login" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">Log In Now</a>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 0;">For your security, please change this password from <strong>Settings</strong> immediately after logging in. If you did not request this, contact our support team right away.</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  const setUserPassword = async () => {
    if (!selectedUser) return;
    const pwd = (tempPassword.trim() || generateTempPassword());
    if (pwd.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!confirm(`Set a temporary password for ${selectedUser.name || selectedUser.email}?\n\nThey can log in with it immediately and change it later.\n\nPassword: ${pwd}`)) {
      return;
    }
    setSettingPassword(true);
    try {
      toast.loading('Setting temporary password...', { id: 'set-pwd' });
      const { error } = await supabase.functions.invoke('admin-action', {
        body: {
          action: 'set-password',
          userId: selectedUser.id,
          password: pwd,
        }
      });
      if (error) throw error;
      setTempPassword(pwd);
      try { await navigator.clipboard.writeText(pwd); } catch { /* clipboard may be blocked */ }

      // Email the user their new credentials and instructions to change it
      try {
        await sendEmailAndLog(
          selectedUser.email,
          'Your temporary RPM password',
          buildTempPasswordEmail(selectedUser.name || selectedUser.email, selectedUser.email, pwd)
        );
      } catch (emailErr) {
        console.warn('[setUserPassword] Failed to email temp password:', emailErr);
      }

      toast.success(`Temp password set, emailed & copied: ${pwd}`, { id: 'set-pwd', duration: 12000 });
    } catch (err: any) {
      toast.error('Failed to set password: ' + err.message, { id: 'set-pwd' });
    } finally {
      setSettingPassword(false);
    }
  };

  const updateInvestmentStatus = async (investmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', investmentId);
      if (error) throw error;
      toast.success('Investment updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateStakingStatus = async (stakingId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('staking_orders').update({ status: newStatus }).eq('id', stakingId);
      if (error) throw error;
      toast.success('Staking order updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updatePropertyStatus = async (propertyId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('property_investments').update({ status: newStatus }).eq('id', propertyId);
      if (error) throw error;
      toast.success('Property investment updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [editInvestmentForm, setEditInvestmentForm] = useState({
    price: '',
    amount_paid: '',
    term_months: '24',
    remaining_balance: '',
    monthly_payment: '',
    status: '',
  });

  const openEditInvestment = (p: any) => {
    setEditingInvestment(p);
    setEditInvestmentForm({
      price: (p.property?.price || p.price || 0).toString(),
      amount_paid: p.amount_paid?.toString() || '0',
      term_months: (p.term_months || 24).toString(),
      remaining_balance: p.remaining_balance?.toString() || '0',
      monthly_payment: p.monthly_payment?.toString() || '0',
      status: p.status || 'pending',
    });
  };

  const handleEditInvestmentFormChange = (field: string, value: string) => {
    setEditInvestmentForm(prev => {
      const updated = { ...prev, [field]: value };
      const priceVal = parseFloat(updated.price) || 0;
      const paidVal = parseFloat(updated.amount_paid) || 0;
      const termVal = parseInt(updated.term_months) || 12;

      const remainingVal = Math.max(0, priceVal - paidVal);
      const monthlyVal = termVal > 0 ? parseFloat((remainingVal / termVal).toFixed(2)) : 0;

      updated.remaining_balance = remainingVal.toString();
      updated.monthly_payment = monthlyVal.toString();
      return updated;
    });
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvestment) return;
    try {
      const remaining = parseFloat(editInvestmentForm.remaining_balance) || 0;
      const monthly = parseFloat(editInvestmentForm.monthly_payment) || 0;
      const { error } = await supabase
        .from('property_investments')
        .update({
          amount_paid: parseFloat(editInvestmentForm.amount_paid) || 0,
          remaining_balance: remaining,
          term_months: parseInt(editInvestmentForm.term_months) || 24,
          monthly_payment: monthly,
          status: editInvestmentForm.status,
        })
        .eq('id', editingInvestment.id);

      if (error) throw error;
      toast.success('Investment updated successfully!');
      setEditingInvestment(null);
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const impersonateUser = (user: User) => {
    const { impersonateUser } = useAuthStore.getState();
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      wallet_balance: user.wallet_balance,
      is_admin: user.is_admin,
      banned: user.banned,
      can_withdraw: user.can_withdraw,
      can_invest: user.can_invest,
      can_stake: user.can_stake,
      can_property: user.can_property,
      restriction_reason: user.restriction_reason,
      fee_required: user.fee_required,
      created_at: user.created_at,
    };
    impersonateUser(profile);
    navigate('/app');
    toast.success(`Impersonating ${user.name || user.email}`);
  };

  const toggleBan = async (userId: string, banned: boolean) => {
    const newStatus = !banned;
    const reason = newStatus ? prompt('Ban reason:') : '';
    if (newStatus && !reason) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ banned: newStatus, ban_reason: reason || null })
        .eq('id', userId);
      if (error) throw error;
      toast.success(newStatus ? 'User banned' : 'User unbanned');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
        <button
          onClick={() => setNewUserModalOpen(true)}
          className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-brand-dark transition-all shrink-0"
        >
          <Plus size={20} /> Create User
        </button>
      </div>

      {/* Live Visitors Hub (Tidio-style real-time presence) */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2 text-white">
            <span className="w-2 h-2 bg-emerald-550 rounded-full animate-ping shrink-0" />
            Live Visitors ({onlineUsers.length})
          </h3>
          <div className="flex items-center gap-1.5">
            {watchedUserIds.size > 0 && (
              <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <BellRing size={10} /> {watchedUserIds.size} watched
              </span>
            )}
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Real-time Presence</span>
          </div>
        </div>

        <input
          type="text"
          value={visitorSearch}
          onChange={(e) => setVisitorSearch(e.target.value)}
          placeholder="Search visitors by name or email…"
          className="w-full bg-slate-850 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand"
        />

        <div className="space-y-2 max-h-[520px] overflow-y-auto overscroll-contain pr-1">
          {onlineUsers.length === 0 ? (
            <p className="text-slate-500 text-xs py-8 text-center font-medium">No visitors currently active online.</p>
          ) : (
            (() => {
              const search = visitorSearch.trim().toLowerCase();
              const filtered = onlineUsers.filter(ou => {
                if (!search) return true;
                const matchedUser = users.find(u => u.id === ou.user_id);
                const name = (ou.name || matchedUser?.name || '').toLowerCase();
                const email = (ou.email || matchedUser?.email || '').toLowerCase();
                return name.includes(search) || email.includes(search);
              });
              const sorted = [...filtered].sort((a, b) => {
                const aWatched = watchedUserIds.has(a.user_id) ? 1 : 0;
                const bWatched = watchedUserIds.has(b.user_id) ? 1 : 0;
                return bWatched - aWatched;
              });
              if (sorted.length === 0) {
                return <p className="text-slate-500 text-xs py-8 text-center font-medium">No visitors match "{visitorSearch}".</p>;
              }
              return sorted.map(ou => {
                const matchedUser = users.find(u => u.id === ou.user_id);
                const name = ou.name || matchedUser?.name || 'Active Visitor';
                const email = ou.email || matchedUser?.email || 'Monitoring page...';
                const isWatched = watchedUserIds.has(ou.user_id);
                const isExpanded = expandedVisitorId === ou.user_id;

                const getPageLabel = (path: string) => {
                  if (path === '/app') return 'Dashboard';
                  if (path.startsWith('/app/wallet')) return 'Wallet';
                  if (path.startsWith('/app/staking')) return 'Staking';
                  if (path.startsWith('/app/invest')) return 'Invest';
                  if (path.startsWith('/app/my-portfolio')) return 'Portfolio';
                  if (path.startsWith('/app/properties')) return 'Properties';
                  if (path.startsWith('/app/referral')) return 'Referrals';
                  if (path.startsWith('/app/chat')) return 'Support Inbox';
                  if (path.startsWith('/app/investor-chat')) return 'Investor Chat';
                  if (path.startsWith('/app/settings')) return 'Settings';
                  if (path.startsWith('/app/notifications')) return 'Notification Center';
                  if (path.startsWith('/app/history')) return 'History';
                  if (path.startsWith('/admin')) return 'Admin Panel';
                  return path || 'Unknown Page';
                };

                return (
                  <div key={ou.user_id} className="bg-slate-850/50 hover:bg-slate-850 rounded-2xl border border-slate-800/60 transition overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <button
                        type="button"
                        onClick={() => toggleVisitorExpanded(ou.user_id)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 pr-2 text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-white flex items-center gap-1">
                            {name}
                            {isWatched && <BellRing size={10} className="text-amber-400 shrink-0" />}
                          </p>
                          <p className="text-[10px] text-slate-450 truncate">{email}</p>
                          <div className="mt-1">
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md text-[9px] font-bold">
                              Viewing: {getPageLabel(ou.current_page)}
                            </span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {matchedUser && (
                          <button
                            type="button"
                            onClick={() => toggleWatch(matchedUser.id, name)}
                            title={isWatched ? 'Stop watching' : 'Watch — get alerted when they come online'}
                            className={`p-1.5 rounded-lg border transition ${isWatched ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-amber-400'}`}
                          >
                            {isWatched ? <BellRing size={13} /> : <Bell size={13} />}
                          </button>
                        )}
                        {matchedUser && (
                          <button
                            type="button"
                            onClick={() => openUserModal(matchedUser)}
                            className="text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-1.5 rounded-lg transition"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-800/60 pt-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-2 flex items-center gap-1">
                          <Clock size={10} /> Recent page history
                        </p>
                        {loadingHistoryFor === ou.user_id ? (
                          <p className="text-slate-500 text-[10px] py-2">Loading history…</p>
                        ) : (visitorHistory[ou.user_id] || []).length === 0 ? (
                          <p className="text-slate-500 text-[10px] py-2">No recorded visits yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {(visitorHistory[ou.user_id] || []).map((v, i, arr) => {
                              // arr is sorted most-recent-first, so the entry
                              // one index earlier (i - 1) is where they
                              // navigated TO next, and the gap between the
                              // two timestamps is how long they stayed here.
                              const isCurrent = i === 0;
                              const next = i > 0 ? arr[i - 1] : null;
                              const durationMs = next
                                ? new Date(next.created_at).getTime() - new Date(v.created_at).getTime()
                                : null;
                              return (
                                <div key={i} className="text-[10px] border-l-2 border-slate-800 pl-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-slate-200 font-semibold truncate max-w-[65%] flex items-center gap-1.5">
                                      {getPageLabel(v.path)}
                                      {isCurrent && (
                                        <span className="text-emerald-400 font-bold text-[9px] flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> here now
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-slate-500 tabular-nums shrink-0">{formatLastSeen(v.created_at)}</span>
                                  </div>
                                  {next && (
                                    <p className="text-slate-500 mt-0.5">
                                      spent {formatDuration(durationMs!)}, then moved to{' '}
                                      <span className="text-slate-300 font-medium">{getPageLabel(next.path)}</span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Balance</th>
                <th className="text-left p-4">Admin</th>
                <th className="text-left p-4">Last Active</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">{u.name}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4">{formatCurrency(u.wallet_balance)}</td>
                  <td className="p-4">{u.is_admin ? 'Yes' : 'No'}</td>
                  <td className="p-4 whitespace-nowrap">
                    {onlineUsers.some(ou => ou.user_id === u.id) ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
                        Online
                      </span>
                    ) : (
                      <span className="text-gray-400 font-semibold text-xs">{formatLastSeen(u.last_seen)}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {u.banned ? (
                      <span className="text-red-600 text-xs font-medium">Banned</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="p-4 space-x-2 whitespace-nowrap">
                    <button onClick={() => openUserModal(u)} className="text-blue-600 hover:text-blue-800" title="Edit user">
                      <Edit size={18} />
                    </button>
                    {!u.is_admin && (
                      <button onClick={() => toggleBan(u.id, u.banned)} className="text-red-600 hover:text-red-800" title={u.banned ? 'Unban' : 'Ban'}>
                        {u.banned ? <UserCheck size={18} /> : <Ban size={18} />}
                      </button>
                    )}
                    <button onClick={() => impersonateUser(u)} className="text-purple-600 hover:text-purple-800" title="Impersonate user">
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => toggleWatch(u.id, u.name || u.email)}
                      className={watchedUserIds.has(u.id) ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-amber-500'}
                      title={watchedUserIds.has(u.id) ? 'Stop watching (online alerts)' : 'Watch — get alerted when they come online'}
                    >
                      {watchedUserIds.has(u.id) ? <BellRing size={18} /> : <Bell size={18} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="p-8 text-gray-500 text-center">No users.</p>}
      </div>

      {/* Edit User Modal */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit User: {selectedUser.name || selectedUser.email}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
              {['profile', 'restrictions', 'wallet', 'investments', 'staking', 'properties', 'chat', 'actions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={editData.email || ''}
                    disabled
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed directly. Use Supabase Auth.</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.is_admin || false}
                      onChange={(e) => setEditData({ ...editData, is_admin: e.target.checked })}
                    />
                    Admin
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.banned || false}
                      onChange={(e) => setEditData({ ...editData, banned: e.target.checked })}
                    />
                    Banned
                  </label>
                </div>
                {editData.banned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ban Reason</label>
                    <input
                      type="text"
                      value={editData.ban_reason || ''}
                      onChange={(e) => setEditData({ ...editData, ban_reason: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <button onClick={saveProfile} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-xl flex items-center gap-2">
                    <Save size={18} /> Save Profile
                  </button>
                  <p className="text-xs text-gray-400 font-medium">Updates user identity information, administrator roles, and general status variables.</p>
                </div>
              </div>
            )}

            {activeTab === 'restrictions' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 text-blue-850 p-3.5 rounded-xl text-xs space-y-1">
                  <p className="font-semibold">Note on Wallet Accessibility</p>
                  <p className="leading-relaxed">
                    Users can always visit the Wallet page to view balances and make deposits (needed to pay required fees). Unchecking <strong>Allow Withdrawals</strong> will only suspend withdrawal actions for this user, keeping deposit functions accessible.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_withdraw !== false}
                      onChange={(e) => setEditData({ ...editData, can_withdraw: e.target.checked })}
                    />
                    Allow Withdrawals
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_invest !== false}
                      onChange={(e) => setEditData({ ...editData, can_invest: e.target.checked })}
                    />
                    Allow Invest
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_stake !== false}
                      onChange={(e) => setEditData({ ...editData, can_stake: e.target.checked })}
                    />
                    Allow Staking
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_property !== false}
                      onChange={(e) => setEditData({ ...editData, can_property: e.target.checked })}
                    />
                    Allow Property Investment
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Restriction Reason</label>
                  <input
                    type="text"
                    value={editData.restriction_reason || ''}
                    onChange={(e) => setEditData({ ...editData, restriction_reason: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                    placeholder="e.g., Requires deposit of $50 to unlock"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fee Required ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.fee_required || 0}
                    onChange={(e) => setEditData({ ...editData, fee_required: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-xs text-gray-400 mt-1">User must deposit this amount before restrictions are lifted.</p>
                </div>
                <div className="space-y-2">
                  <button onClick={saveProfile} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-xl flex items-center gap-2">
                    <Save size={18} /> Save Restrictions
                  </button>
                  <p className="text-xs text-gray-400 font-medium">Saves permission locks for the selected user. If 'Fee Required' is set and greater than 0, user will need to top up or deposit this amount to regain full access.</p>
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(selectedUser.wallet_balance || 0)}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Top-up Amount</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                        placeholder="50.00"
                      />
                      <button onClick={handleTopup} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl flex items-center gap-1">
                        <Plus size={18} /> Add
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">Adds funds to the user's active wallet balance instantly. Resets active restrictions if this amount satisfies the required fee.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Deduct Amount</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={deductAmount}
                        onChange={(e) => setDeductAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                        placeholder="25.00"
                      />
                      <button onClick={handleDeduct} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-1">
                        <Minus size={18} /> Deduct
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">Removes funds from the user's active wallet balance. Minimum balance constraints apply.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'investments' && (
              <div>
                {loadingDetails ? (
                  <p>Loading investments...</p>
                ) : investments.length === 0 ? (
                  <p className="text-gray-500">No investments.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Plan</th>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">Daily %</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {investments.map((inv) => (
                          <tr key={inv.id} className="border-t">
                            <td className="p-2">{inv.product_name}</td>
                            <td className="p-2">{formatCurrency(inv.amount)}</td>
                            <td className="p-2">{inv.daily_return}%</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${inv.status === 'active' ? 'bg-green-100 text-green-700' : inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{inv.status}</span>
                            </td>
                            <td className="p-2">
                              <select
                                value={inv.status}
                                onChange={(e) => updateInvestmentStatus(inv.id, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'staking' && (
              <div>
                {loadingDetails ? (
                  <p>Loading staking orders...</p>
                ) : stakingOrders.length === 0 ? (
                  <p className="text-gray-500">No staking orders.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">APY</th>
                        <th className="p-2 text-left">Lock Days</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {stakingOrders.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{formatCurrency(s.amount)}</td>
                            <td className="p-2">{s.apy}%</td>
                            <td className="p-2">{s.lock_days}d</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s.status}</span>
                            </td>
                            <td className="p-2">
                              <select
                                value={s.status}
                                onChange={(e) => updateStakingStatus(s.id, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="withdrawn_early">Withdrawn Early</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'properties' && (
              <div>
                {loadingDetails ? (
                  <p>Loading property investments...</p>
                ) : propertyInvestments.length === 0 ? (
                  <p className="text-gray-500">No property investments.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Property</th>
                        <th className="p-2 text-left">Paid</th>
                        <th className="p-2 text-left">Remaining</th>
                        <th className="p-2 text-left">Term</th>
                        <th className="p-2 text-left">Installment</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {propertyInvestments.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{(p as any).property?.title || 'N/A'}</td>
                            <td className="p-2">{formatCurrency(p.amount_paid)}</td>
                            <td className="p-2">{formatCurrency(p.remaining_balance)}</td>
                            <td className="p-2">{p.term_months ? `${p.term_months}m` : '12m'}</td>
                            <td className="p-2">{formatCurrency(p.monthly_payment || 0)}/m</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <select
                                  value={p.status}
                                  onChange={(e) => updatePropertyStatus(p.id, e.target.value)}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="active">Active</option>
                                  <option value="completed">Completed</option>
                                  <option value="defaulted">Defaulted</option>
                                </select>
                                <button
                                  onClick={() => openEditInvestment(p)}
                                  className="text-brand hover:text-brand-dark font-medium text-xs px-2 py-1 bg-brand/5 border border-brand/10 rounded transition"
                                >
                                  Edit Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-[400px] bg-gray-50 border border-gray-150 rounded-2xl overflow-hidden mb-6">
                {/* Message display area */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-sm font-semibold">No message history with this user</p>
                      <p className="text-xs text-gray-300 mt-1">Send a message below to start a live support chat.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-2`}>
                          {!isMe && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition mr-1.5 self-center shrink-0"
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm relative ${
                            isMe 
                              ? 'bg-gray-900 text-white rounded-tr-none' 
                              : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                          }`}>
                            <p className="leading-relaxed break-words">{msg.body}</p>
                            <div className="flex items-center justify-end gap-1.5 mt-1 text-[9px] font-medium opacity-60">
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isMe && (
                                <span title={msg.read ? "Read by user" : "Sent"}>
                                  {msg.read ? (
                                    <CheckCheck size={11} className="text-emerald-300 inline" />
                                  ) : (
                                    <Check size={11} className="text-white/60 inline" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {isMe && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition ml-1.5 self-center shrink-0"
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={sendModalChat} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder="Type support reply..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    disabled={sendingChat}
                  />
                  <button
                    type="submit"
                    disabled={!chatText.trim() || sendingChat}
                    className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 text-white rounded-xl px-4 py-2 text-xs transition flex items-center justify-center font-bold disabled:text-gray-400"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Send Email</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Preset Template</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand"
                      >
                        <option value="">-- Manual (No Template) --</option>
                        {emailTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name} (Preset)</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                      placeholder="Subject"
                    />
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand font-mono text-xs"
                      placeholder="Message content (supports raw HTML templates)..."
                    />
                    <div>
                      <button
                        onClick={sendEmail}
                        disabled={sendingEmail}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-70"
                      >
                        <Mail size={18} /> {sendingEmail ? 'Sending...' : 'Send Email'}
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">Sends email notification directly to this user's registered address, using preset HTML formatting.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Account Actions</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={resetPassword}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Lock size={18} /> Reset Password
                      </button>
                      <button
                        onClick={generateMagicLink}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Key size={18} /> Magic Link
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete user ${selectedUser.name || selectedUser.email}?`)) {
                            toast.loading('Deleting user...', { id: 'delete-user' });
                            try {
                              const { error } = await supabase.functions.invoke('admin-action', {
                                body: {
                                  action: 'delete-user',
                                  userId: selectedUser.id
                                }
                              });
                              if (error) throw error;
                              toast.success('User deleted successfully', { id: 'delete-user' });
                              setModalOpen(false);
                              fetchUsers();
                            } catch (err: any) {
                              toast.error('Failed to delete user: ' + err.message, { id: 'delete-user' });
                            }
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Ban size={18} /> Delete Account
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <input
                        type="text"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        placeholder="Auto-generate or type a temp password"
                        className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setTempPassword(generateTempPassword())}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                      >
                        <Key size={16} /> Generate
                      </button>
                      <button
                        type="button"
                        onClick={setUserPassword}
                        disabled={settingPassword}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-70"
                      >
                        <Lock size={16} /> {settingPassword ? 'Setting...' : 'Set Temp Password'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-medium"><strong className="text-green-600">Set Temp Password:</strong> Directly sets a working password for this user (copied to clipboard). They can log in with it right away and change it later in Settings.</p>
                      <p className="text-[10px] text-gray-400 font-medium"><strong className="text-amber-600">Reset Password:</strong> Securely generates and copies a password recovery link to the clipboard.</p>
                      <p className="text-[10px] text-gray-400 font-medium"><strong className="text-blue-600">Magic Link:</strong> Generates and copies a direct, passwordless login link to the clipboard.</p>
                      <p className="text-[10px] text-gray-400 font-medium"><strong className="text-red-600">Delete Account:</strong> Permanently and irreversibly removes the user and profile database records.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {newUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
              <button onClick={() => setNewUserModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="•••••••• (min 6 characters)"
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Initial Wallet Balance (USD, optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newUserBalance}
                  onChange={(e) => setNewUserBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 text-sm"
                >
                  {creatingUser ? 'Creating User...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewUserModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Property Investment Modal */}
      {editingInvestment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Property Investment</h2>
                <p className="text-xs text-gray-400 mt-0.5">{(editingInvestment as any).property?.title || 'N/A'}</p>
              </div>
              <button onClick={() => setEditingInvestment(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveInvestment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Property Price (Main Amount)</label>
                <input
                  type="number"
                  value={editInvestmentForm.price}
                  onChange={(e) => handleEditInvestmentFormChange('price', e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Amount Paid (Amount to be Paid)</label>
                <input
                  type="number"
                  value={editInvestmentForm.amount_paid}
                  onChange={(e) => handleEditInvestmentFormChange('amount_paid', e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Term (months)</label>
                <select
                  value={editInvestmentForm.term_months}
                  onChange={(e) => handleEditInvestmentFormChange('term_months', e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                >
                  <option value="24">2 Years (24 months)</option>
                  <option value="36">3 Years (36 months)</option>
                  <option value="48">4 Years (48 months)</option>
                  <option value="60">5 Years (60 months)</option>
                  <option value="72">6 Years (72 months)</option>
                </select>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 border">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Remaining Balance:</span>
                  <span className="font-semibold text-gray-800">${parseFloat(editInvestmentForm.remaining_balance).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Calculated Installment:</span>
                  <span className="font-semibold text-gray-800">${parseFloat(editInvestmentForm.monthly_payment).toLocaleString()} / month</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Status</label>
                <select
                  value={editInvestmentForm.status}
                  onChange={(e) => setEditInvestmentForm({ ...editInvestmentForm, status: e.target.value })}
                  className="w-full border rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-brand text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="defaulted">Defaulted</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition text-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInvestment(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}