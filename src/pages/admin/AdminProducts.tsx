import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  min_invest: number;
  max_invest: number;
  daily_return: number;
  duration_days: number;
  status: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    min_invest: '',
    max_invest: '',
    daily_return: '',
    duration_days: '',
    status: 'active',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description,
      min_invest: parseFloat(form.min_invest),
      max_invest: parseFloat(form.max_invest),
      daily_return: parseFloat(form.daily_return),
      duration_days: parseInt(form.duration_days),
      status: form.status,
    };
    try {
      if (editing) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        toast.success('Product created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', min_invest: '', max_invest: '', daily_return: '', duration_days: '', status: 'active' });
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Deleted');
      fetchProducts();
    }
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || '',
      min_invest: product.min_invest.toString(),
      max_invest: product.max_invest.toString(),
      daily_return: product.daily_return.toString(),
      duration_days: product.duration_days.toString(),
      status: product.status,
    });
    setShowForm(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Products</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', description: '', min_invest: '', max_invest: '', daily_return: '', duration_days: '', status: 'active' }); }}
          className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <Plus size={20} /> New Product
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Product</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
            />
            <input
              type="number"
              placeholder="Min Invest"
              value={form.min_invest}
              onChange={(e) => setForm({ ...form, min_invest: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
              required
            />
            <input
              type="number"
              placeholder="Max Invest"
              value={form.max_invest}
              onChange={(e) => setForm({ ...form, max_invest: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Daily Return %"
              value={form.daily_return}
              onChange={(e) => setForm({ ...form, daily_return: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
              required
            />
            <input
              type="number"
              placeholder="Duration (days)"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
              required
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="border border-gray-300 rounded-xl px-4 py-2"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-6 py-2 rounded-xl">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Min</th>
              <th className="text-left p-4">Max</th>
              <th className="text-left p-4">Daily %</th>
              <th className="text-left p-4">Duration</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.name}</td>
                <td className="p-4">${p.min_invest}</td>
                <td className="p-4">${p.max_invest}</td>
                <td className="p-4">{p.daily_return}%</td>
                <td className="p-4">{p.duration_days} d</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-4 space-x-2">
                  <button onClick={() => openEdit(p)} className="text-blue-600"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600"><Trash size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-8 text-gray-500 text-center">No products.</p>}
      </div>
    </div>
  );
}