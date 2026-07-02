import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';

interface Order {
  id: string;
  user_id: string;
  product_name: string;
  amount: number;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string };
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error('Failed to load orders');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      // Record transaction if activating
      if (newStatus === 'active') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          await supabase.from('transactions').insert({
            user_id: order.user_id,
            type: 'investment',
            amount: order.amount,
            description: `Investment in ${order.product_name} activated`,
            status: 'completed',
          });
        }
      }
      toast.success(`Order ${newStatus === 'active' ? 'activated' : newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'active', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === s ? 'bg-brand text-white' : 'bg-gray-100'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">User</th>
              <th className="text-left p-4">Plan</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t">
                <td className="p-4">{order.profiles?.name || order.user_id}</td>
                <td className="p-4">{order.product_name}</td>
                <td className="p-4">{formatCurrency(order.amount)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'active' ? 'bg-green-100 text-green-700' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="p-4 space-x-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'active')}
                      className="text-green-600 hover:text-green-800"
                    >
                      <CheckCircle size={20} />
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      className="text-red-600 hover:text-red-800"
                    >
                      <XCircle size={20} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-8 text-gray-500 text-center">No orders found.</p>}
      </div>
    </div>
  );
}