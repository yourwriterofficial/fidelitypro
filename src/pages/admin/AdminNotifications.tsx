import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Send, Trash, RefreshCw, ShieldAlert } from 'lucide-react';
import { notifyUsers } from '../../lib/notify';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  wallet_balance: number;
  banned: boolean;
  is_admin: boolean;
}

export default function AdminNotifications() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);

  // Segmentation
  const [segment, setSegment] = useState('all');
  const [ordersUserIds, setOrdersUserIds] = useState<Set<string>>(new Set());
  const [inactivityHours, setInactivityHours] = useState(24);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setSending(true);
    try {
      const [profilesRes, ordersRes, settingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, created_at, wallet_balance, banned, is_admin')
          .order('created_at', { ascending: false }),
        supabase.from('orders').select('user_id'),
        supabase.from('settings').select('value').eq('key', 'inactivity_hours').maybeSingle()
      ]);

      if (profilesRes.error) throw profilesRes.error;
      
      setUsers(profilesRes.data || []);
      setOrdersUserIds(new Set((ordersRes.data || []).map(o => o.user_id)));
      if (settingsRes?.data?.value) {
        setInactivityHours(parseInt(settingsRes.data.value) || 24);
      }
    } catch (err: any) {
      toast.error('Failed to load segment data');
    } finally {
      setSending(false);
    }
  };

  // Re-calculate selected users when segment selection changes
  useEffect(() => {
    if (segment === 'all') {
      setSelectedUsers([]);
    } else if (segment === 'restricted') {
      const limitMs = inactivityHours * 60 * 60 * 1000;
      const now = Date.now();
      const filtered = users.filter(u => {
        if (u.is_admin) return false;
        const hasOrders = ordersUserIds.has(u.id);
        const hasBalance = (u.wallet_balance || 0) > 0;
        if (hasOrders || hasBalance) return false;
        const ageMs = now - new Date(u.created_at).getTime();
        return ageMs > limitMs;
      });
      setSelectedUsers(filtered.map(u => u.id));
    } else if (segment === 'new') {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const filtered = users.filter(u => (now - new Date(u.created_at).getTime()) <= sevenDaysMs);
      setSelectedUsers(filtered.map(u => u.id));
    } else if (segment === 'active') {
      const filtered = users.filter(u => ordersUserIds.has(u.id));
      setSelectedUsers(filtered.map(u => u.id));
    } else if (segment === 'banned') {
      const filtered = users.filter(u => u.banned === true);
      setSelectedUsers(filtered.map(u => u.id));
    }
  }, [segment, users, ordersUserIds, inactivityHours]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }
    const targetUsers = segment === 'all' ? users.map(u => u.id) : selectedUsers;
    if (targetUsers.length === 0) {
      toast.error('No recipients match the selected segment');
      return;
    }
    setSending(true);
    try {
      await notifyUsers(targetUsers, {
        title,
        message,
        type: type as any,
        link: link || undefined,
      });
      toast.success(`Successfully dispatched notification to ${targetUsers.length} users`);
      setTitle('');
      setMessage('');
      setLink('');
      setSegment('all');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePrune = async () => {
    if (!confirm('Are you sure you want to permanently delete all notifications in the system?')) return;
    const { error } = await supabase.from('notifications').delete().neq('id', '');
    if (error) toast.error(error.message);
    else toast.success('All system notifications cleared');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Broadcast Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">Send targeted in-app alerts and push notifications to user segments.</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shrink-0 flex items-center gap-2 text-sm text-gray-600 font-semibold"
        >
          <RefreshCw size={15} /> Refresh List
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gray-50/50">
          <div className="p-2 bg-brand/10 text-brand rounded-xl"><Send size={18} /></div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Create Broadcast</h2>
            <p className="text-xs text-gray-400">Configure message template and segment targeting</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notification Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Account Security Verification"
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Action Link (Optional)</label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="e.g. /app/wallet"
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Enter message body..."
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alert Level Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="info">Information (Blue)</option>
                <option value="success">Success (Green)</option>
                <option value="warning">Warning (Orange)</option>
                <option value="alert">Critical / Action-Required (Red)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="all">All Users ({users.length})</option>
                <option value="restricted">Restricted / Inactive Users</option>
                <option value="new">New Users (Registered Last 7 Days)</option>
                <option value="active">Active Investors (At least 1 Order)</option>
                <option value="banned">Banned/Suspended Users</option>
                <option value="custom">Custom Recipient Selection</option>
              </select>
            </div>
          </div>

          {/* Segment Details & User Picker */}
          {segment === 'custom' && (
            <div className="space-y-2 border border-gray-100 bg-gray-50/50 rounded-xl p-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Select Recipients</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-150 hover:bg-gray-50 transition cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, u.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                        }
                      }}
                      className="rounded text-brand border-gray-300 focus:ring-brand w-3.5 h-3.5"
                    />
                    <div className="truncate min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{u.name || 'Investor'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {segment !== 'all' && segment !== 'custom' && (
            <div className="bg-amber-55/10 border border-amber-200/50 rounded-xl p-4 flex items-start gap-3">
              <div className="p-1 rounded bg-amber-100 text-amber-600 mt-0.5"><ShieldAlert size={14} /></div>
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Target Summary</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  This broadcast will target <strong>{selectedUsers.length}</strong> matching user{selectedUsers.length !== 1 ? 's' : ''} out of {users.length} total.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <button
              type="submit"
              disabled={sending}
              className="bg-brand hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-70 text-sm shadow-sm"
            >
              <Send size={16} /> {sending ? 'Dispatching...' : 'Send Broadcast'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handlePrune}
          className="border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition"
        >
          <Trash size={16} /> Prune All System Notifications
        </button>
      </div>
    </div>
  );
}