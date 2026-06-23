import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash } from 'lucide-react';

export default function AdminProperties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    down_payment_percent: '50',
    monthly_payment: '',
    term_months: '12',
    image_urls: '',
    status: 'active',
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load properties');
    else setProperties(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      down_payment_percent: parseFloat(form.down_payment_percent),
      monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
      term_months: parseInt(form.term_months),
      image_urls: form.image_urls.split(',').map(s => s.trim()).filter(Boolean),
      status: form.status,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('properties').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Property updated');
      } else {
        const { error } = await supabase.from('properties').insert(payload);
        if (error) throw error;
        toast.success('Property created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', description: '', price: '', down_payment_percent: '50', monthly_payment: '', term_months: '12', image_urls: '', status: 'active' });
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return;
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); fetchProperties(); }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Properties</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ title: '', description: '', price: '', down_payment_percent: '50', monthly_payment: '', term_months: '12', image_urls: '', status: 'active' }); }} className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2"><Plus size={20} /> New</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Property</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input type="text" placeholder="e.g., Luxury Villa in Lagos" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Name of the property.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea placeholder="Detailed description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Describe the property and its features.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input type="number" placeholder="100000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Total price of the property.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
              <input type="number" placeholder="50" value={form.down_payment_percent} onChange={(e) => setForm({ ...form, down_payment_percent: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">% required as initial down payment.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Monthly Payment ($)</label>
              <input type="number" placeholder="5000" value={form.monthly_payment} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Optional – if fixed monthly payment is known.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Term (months)</label>
              <input type="number" placeholder="12" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Payment term in months.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Image URLs</label>
              <input type="text" placeholder="https://example.com/img1.jpg, https://..." value={form.image_urls} onChange={(e) => setForm({ ...form, image_urls: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Comma separated image URLs.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Active properties appear on the user page.</p>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-6 py-2 rounded-xl">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-4 text-left">Title</th><th className="p-4 text-left">Price</th><th className="p-4 text-left">Down %</th><th className="p-4 text-left">Term</th><th className="p-4 text-left">Status</th><th className="p-4 text-left">Actions</th></tr></thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.title}</td>
                <td className="p-4">${p.price.toLocaleString()}</td>
                <td className="p-4">{p.down_payment_percent}%</td>
                <td className="p-4">{p.term_months}m</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span></td>
                <td className="p-4 space-x-2">
                  <button onClick={() => { setEditing(p); setForm({ title: p.title, description: p.description || '', price: p.price.toString(), down_payment_percent: p.down_payment_percent.toString(), monthly_payment: p.monthly_payment ? p.monthly_payment.toString() : '', term_months: p.term_months.toString(), image_urls: (p.image_urls || []).join(', '), status: p.status }); setShowForm(true); }} className="text-blue-500"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500"><Trash size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && <p className="p-8 text-gray-500 text-center">No properties.</p>}
      </div>
    </div>
  );
}