import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Send, Trash, RefreshCw } from 'lucide-react';

export default function AdminNotifications() {
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load users');
    } else {
      setUsers(data || []);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }
    const targetUsers = selectedUsers.length === 0 ? users.map(u => u.id) : selectedUsers;
    if (targetUsers.length === 0) {
      toast.error('No users selected');
      return;
    }
    setSending(true);
    try {
      const notifications = targetUsers.map(user_id => ({
        user_id,
        title,
        message,
        type,
        link: link || null,
        read: false,
        created_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;
      toast.success(`Sent to ${targetUsers.length} users`);
      setTitle('');
      setMessage('');
      setLink('');
      setSelectedUsers([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePrune = async () => {
    if (!confirm('Delete all notifications?')) return;
    const { error } = await supabase.from('notifications').delete().neq('id', '');
    if (error) toast.error(error.message);
    else toast.success('All notifications deleted');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notifications</h1>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Send Notification</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Link (optional)</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
              placeholder="/app/wallet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Recipients</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-xl">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-1 text-sm">
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
                  />
                  {u.name || u.email}
                </label>
              ))}
              {users.length === 0 && <span className="text-gray-500 text-sm">No users</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave unchecked to send to all users.</p>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="bg-brand hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition disabled:opacity-70"
          >
            <Send size={18} /> {sending ? 'Sending...' : 'Send Notification'}
          </button>
        </form>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handlePrune}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <Trash size={18} /> Prune All Notifications
        </button>
        <button
          onClick={fetchUsers}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <RefreshCw size={18} /> Refresh Users
        </button>
      </div>
    </div>
  );
}