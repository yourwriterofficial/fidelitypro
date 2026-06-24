import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Users, Package, DollarSign, ShoppingCart, Lock, Building, Gift, Bell, UserPlus, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalInvested: 0,
    pendingWithdrawals: 0,
    activeStaking: 0,
    propertyInvestments: 0,
    totalReferrals: 0,
    announcements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [
        { count: users },
        { count: orders },
        { data: invested },
        { count: pendingWithdrawals },
        { count: staking },
        { count: properties },
        { count: referrals },
        { count: announcements },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('amount').eq('status', 'active'),
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('staking_orders').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('property_investments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('referrals').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
      ]);
      const totalInvested = invested?.reduce((sum, o) => sum + o.amount, 0) || 0;
      setStats({
        totalUsers: users || 0,
        totalOrders: orders || 0,
        totalInvested,
        pendingWithdrawals: pendingWithdrawals || 0,
        activeStaking: staking || 0,
        propertyInvestments: properties || 0,
        totalReferrals: referrals || 0,
        announcements: announcements || 0,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id, user_id, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: deposits } = await supabase
        .from('deposits')
        .select('id, user_id, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id, product_name, amount, status, created_at, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      const all = [...(withdrawals || []), ...(deposits || []), ...(orders || [])];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(all.slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: { name: newUser.name },
      });
      if (error) throw error;
      toast.success('User created successfully');
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', name: '' });
      fetchStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={() => setShowCreateUser(true)}
          className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <UserPlus size={20} /> Create User
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><Users size={24} /></div>
          <div><p className="text-xs text-gray-500">Users</p><p className="text-xl font-bold">{stats.totalUsers}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl text-purple-600"><ShoppingCart size={24} /></div>
          <div><p className="text-xs text-gray-500">Orders</p><p className="text-xl font-bold">{stats.totalOrders}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl text-green-600"><DollarSign size={24} /></div>
          <div><p className="text-xs text-gray-500">Invested</p><p className="text-xl font-bold">{formatCurrency(stats.totalInvested)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-xl text-yellow-600"><Package size={24} /></div>
          <div><p className="text-xs text-gray-500">Pending Withdrawals</p><p className="text-xl font-bold">{stats.pendingWithdrawals}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><Lock size={24} /></div>
          <div><p className="text-xs text-gray-500">Active Staking</p><p className="text-xl font-bold">{stats.activeStaking}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-xl text-orange-600"><Building size={24} /></div>
          <div><p className="text-xs text-gray-500">Property Investments</p><p className="text-xl font-bold">{stats.propertyInvestments}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-pink-100 rounded-xl text-pink-600"><Gift size={24} /></div>
          <div><p className="text-xs text-gray-500">Referrals</p><p className="text-xl font-bold">{stats.totalReferrals}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-xl text-cyan-600"><Bell size={24} /></div>
          <div><p className="text-xs text-gray-500">Announcements</p><p className="text-xl font-bold">{stats.announcements}</p></div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Activity size={20} className="text-brand" /> Recent Activity</h2>
          <Link to="/admin/logs" className="text-sm text-brand hover:underline">View all logs</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-gray-500">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <p className="text-sm font-medium">{item.profiles?.name || item.user_id}</p>
                  <p className="text-xs text-gray-500">
                    {item.status && <span className={`px-2 py-0.5 rounded-full text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : item.status === 'active' || item.status === 'confirmed' || item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{item.status}</span>}
                    {item.product_name && ` – ${item.product_name}`}
                    {item.amount && ` – ${formatCurrency(item.amount)}`}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-xl transition disabled:opacity-70"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 py-2 rounded-xl"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}