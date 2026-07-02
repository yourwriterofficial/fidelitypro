import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash, X } from 'lucide-react';

const CATEGORY_SUGGESTIONS = ['House', 'Apartment', 'Land', 'Car', 'Business', 'Other'];

const emptyForm = {
  category: 'House',
  title: '',
  description: '',
  price: '',
  down_payment_percent: '50',
  monthly_payment: '',
  term_months: '12',
  status: 'active',
};

export default function AdminProperties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  // One image URL per input box. Always keep at least one box.
  const [images, setImages] = useState<string[]>(['']);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load listings');
    else setProperties(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setImages(['']);
    setEditing(null);
  };

  const updateImage = (i: number, value: string) =>
    setImages(prev => prev.map((u, idx) => (idx === i ? value : u)));
  const addImage = () => setImages(prev => [...prev, '']);
  const removeImage = (i: number) =>
    setImages(prev => (prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      category: form.category.trim() || 'Other',
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      down_payment_percent: parseFloat(form.down_payment_percent),
      monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
      term_months: parseInt(form.term_months),
      image_urls: images.map(s => s.trim()).filter(Boolean),
      status: form.status,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('properties').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Listing updated');
      } else {
        const { error } = await supabase.from('properties').insert(payload);
        if (error) throw error;
        toast.success('Listing created');
      }
      setShowForm(false);
      resetForm();
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      category: p.category || 'House',
      title: p.title,
      description: p.description || '',
      price: p.price.toString(),
      down_payment_percent: p.down_payment_percent.toString(),
      monthly_payment: p.monthly_payment ? p.monthly_payment.toString() : '',
      term_months: p.term_months.toString(),
      status: p.status,
    });
    setImages(p.image_urls && p.image_urls.length > 0 ? [...p.image_urls] : ['']);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); fetchProperties(); }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Listings</h1>
          <p className="text-sm text-gray-400 mt-0.5">Post houses, cars, land, or any item for installment purchase.</p>
        </div>
        <button onClick={openNew} className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2 shrink-0 self-start sm:self-auto"><Plus size={20} /> New</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Listing</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input type="text" list="category-suggestions" placeholder="e.g., House, Car, Land…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <datalist id="category-suggestions">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Type of item. Choose a suggestion or enter your own.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input type="text" placeholder="e.g., Luxury Villa in Lagos / Toyota Camry 2023" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Name of the item.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea placeholder="Detailed description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Describe the item and its features.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input type="number" placeholder="100000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Total price of the item.</p>
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

            {/* Images — one URL per input box */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Images</label>
              <div className="space-y-2 mt-1">
                {images.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => updateImage(i, e.target.value)}
                      className="border rounded-xl px-4 py-2 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"
                      aria-label="Remove image"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addImage}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <Plus size={15} /> Add another image
              </button>
              <p className="text-xs text-gray-400 mt-1">One image URL per box. Add multiple to enable the scrolling gallery on the user's page.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Active listings appear on the user page.</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save Listing</button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="bg-gray-200 px-6 py-2 rounded-xl">Cancel</button>
              </div>
              <p className="text-xs text-gray-400 font-medium">Saves the listing. Active listings are instantly viewable on the user portfolio platform.</p>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50"><tr><th className="p-4 text-left">Category</th><th className="p-4 text-left">Title</th><th className="p-4 text-left">Price</th><th className="p-4 text-left">Down %</th><th className="p-4 text-left">Term</th><th className="p-4 text-left">Status</th><th className="p-4 text-left">Actions</th></tr></thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4"><span className="px-2 py-1 rounded-full text-xs bg-brand/10 text-brand font-medium">{p.category || 'Property'}</span></td>
                <td className="p-4">{p.title}</td>
                <td className="p-4">${p.price.toLocaleString()}</td>
                <td className="p-4">{p.down_payment_percent}%</td>
                <td className="p-4">{p.term_months}m</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span></td>
                <td className="p-4 space-x-2 whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="text-blue-500"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500"><Trash size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && <p className="p-8 text-gray-500 text-center">No listings.</p>}
      </div>
    </div>
  );
}
