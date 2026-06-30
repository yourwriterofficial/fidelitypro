import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash, Pin, X, Megaphone } from 'lucide-react';

interface Announcement {
  id: string; title: string; content: string; image_url: string;
  is_pinned: boolean; created_at: string;
}
const emptyForm = { title: '', content: '', image_url: '', is_pinned: false };

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) toast.error('Failed to load announcements'); else setAnnouncements(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const { error } = await supabase.from('announcements').update(form).eq('id', editing.id);
        if (error) throw error; toast.success('Updated');
      } else {
        const { error } = await supabase.from('announcements').insert(form);
        if (error) throw error; toast.success('Created');
      }
      setShowForm(false); setEditing(null); setForm(emptyForm); fetchAnnouncements();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); fetchAnnouncements(); }
  };

  const handlePin = async (id: string, currentPinned: boolean) => {
    const { error } = await supabase.from('announcements').update({ is_pinned: !currentPinned }).eq('id', id);
    if (error) toast.error(error.message); else fetchAnnouncements();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{announcements.length} total · {announcements.filter(a => a.is_pinned).length} pinned</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm transition">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Announcement</h2>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input type="text" placeholder="Announcement title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
              <textarea placeholder="Write announcement content..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent resize-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL (optional)</label>
              <input type="text" placeholder="https://example.com/image.jpg" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="rounded accent-amber-500 w-4 h-4" />
              <span className="text-sm text-gray-700 font-medium">Pin this announcement to top</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="bg-brand hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition">Save</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-2xl" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center">
          <Megaphone size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${a.is_pinned ? 'border-amber-200' : 'border-gray-100'}`}>
              {a.is_pinned && <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />}
              <div className="flex items-start gap-4 p-5">
                {a.image_url && (
                  <img src={a.image_url} alt={a.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    {a.is_pinned && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-medium flex items-center gap-1"><Pin size={9} /> Pinned</span>}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handlePin(a.id, a.is_pinned)} title={a.is_pinned ? 'Unpin' : 'Pin'}
                    className={`p-1.5 rounded-lg transition ${a.is_pinned ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}><Pin size={15} /></button>
                  <button onClick={() => { setEditing(a); setForm({ title: a.title, content: a.content, image_url: a.image_url || '', is_pinned: a.is_pinned }); setShowForm(true); }}
                    className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition"><Trash size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
