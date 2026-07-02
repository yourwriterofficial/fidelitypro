import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  apy: number;
  lock_days: number;
  early_withdrawal_penalty: number;
  status: string;
}

export default function AdminStaking() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    min_amount: '',
    max_amount: '',
    apy: '',
    lock_days: '',
    early_withdrawal_penalty: '0',
    status: 'active',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('staking_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load staking products');
    else setProducts(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description,
      min_amount: parseFloat(form.min_amount),
      max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
      apy: parseFloat(form.apy),
      lock_days: parseInt(form.lock_days),
      early_withdrawal_penalty: parseFloat(form.early_withdrawal_penalty),
      status: form.status,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('staking_products').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Staking product updated');
      } else {
        const { error } = await supabase.from('staking_products').insert(payload);
        if (error) throw error;
        toast.success('Staking product created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', min_amount: '', max_amount: '', apy: '', lock_days: '', early_withdrawal_penalty: '0', status: 'active' });
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await supabase.from('staking_products').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); fetchProducts(); }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Staking Products</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', description: '', min_amount: '', max_amount: '', apy: '', lock_days: '', early_withdrawal_penalty: '0', status: 'active' }); }} className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2"><Plus size={20} /> New</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Staking Product</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" placeholder="e.g., 90-Day Staking" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Display name of the staking product.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input type="text" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Explain the benefits or terms.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Min Amount ($)</label>
              <input type="number" placeholder="10" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Minimum amount a user can stake.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Amount ($)</label>
              <input type="number" placeholder="Leave empty for unlimited" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Maximum stake (optional).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">APY (%)</label>
              <input type="number" step="0.01" placeholder="12.5" value={form.apy} onChange={(e) => setForm({ ...form, apy: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Annual percentage yield.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Lock Period (days)</label>
              <input type="number" placeholder="90" value={form.lock_days} onChange={(e) => setForm({ ...form, lock_days: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">How many days the funds are locked.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Early Withdrawal Penalty (%)</label>
              <input type="number" step="0.5" placeholder="10" value={form.early_withdrawal_penalty} onChange={(e) => setForm({ ...form, early_withdrawal_penalty: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">% deducted if user withdraws before lock period ends.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Active products are shown to users.</p>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-6 py-2 rounded-xl">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50"><tr><th className="p-4 text-left">Name</th><th className="p-4 text-left">APY</th><th className="p-4 text-left">Lock</th><th className="p-4 text-left">Min</th><th className="p-4 text-left">Penalty</th><th className="p-4 text-left">Status</th><th className="p-4 text-left">Actions</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.name}</td>
                <td className="p-4">{p.apy}%</td>
                <td className="p-4">{p.lock_days}d</td>
                <td className="p-4">${p.min_amount}</td>
                <td className="p-4">{p.early_withdrawal_penalty}%</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span></td>
                <td className="p-4 space-x-2">
                  <button onClick={() => { setEditing(p); setForm({ name: p.name, description: p.description || '', min_amount: p.min_amount.toString(), max_amount: p.max_amount ? p.max_amount.toString() : '', apy: p.apy.toString(), lock_days: p.lock_days.toString(), early_withdrawal_penalty: p.early_withdrawal_penalty.toString(), status: p.status }); setShowForm(true); }} className="text-blue-500"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500"><Trash size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-8 text-gray-500 text-center">No staking products.</p>}
      </div>
    </div>
  );
}