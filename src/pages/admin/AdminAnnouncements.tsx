import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash, Pin } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url: string;
  is_pinned: boolean;
  created_at: string;
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: '', content: '', image_url: '', is_pinned: false });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load announcements');
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const { error } = await supabase
          .from('announcements')
          .update(form)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Announcement updated');
      } else {
        const { error } = await supabase.from('announcements').insert(form);
        if (error) throw error;
        toast.success('Announcement created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', content: '', image_url: '', is_pinned: false });
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      fetchAnnouncements();
    }
  };

  const handlePin = async (id: string, currentPinned: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_pinned: !currentPinned })
      .eq('id', id);
    if (error) toast.error(error.message);
    else fetchAnnouncements();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Announcements</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ title: '', content: '', image_url: '', is_pinned: false }); }} className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2"><Plus size={20} /> New</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Announcement</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-xl px-4 py-2" required />
            <textarea placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} className="w-full border rounded-xl px-4 py-2" required />
            <input type="text" placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="w-full border rounded-xl px-4 py-2" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} /> Pin this announcement</label>
            <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="bg-gray-200 px-6 py-2 rounded-xl ml-2">Cancel</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {announcements.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{a.title} {a.is_pinned && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">Pinned</span>}</h3>
              <p className="text-sm text-gray-600 mt-1">{a.content}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handlePin(a.id, a.is_pinned)} className="text-gray-500 hover:text-yellow-600"><Pin size={18} /></button>
              <button onClick={() => { setEditing(a); setForm({ title: a.title, content: a.content, image_url: a.image_url || '', is_pinned: a.is_pinned }); setShowForm(true); }} className="text-blue-500"><Edit size={18} /></button>
              <button onClick={() => handleDelete(a.id)} className="text-red-500"><Trash size={18} /></button>
            </div>
          </div>
        ))}
        {announcements.length === 0 && <p className="text-gray-500 text-center py-8">No announcements yet.</p>}
      </div>
    </div>
  );
}