import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Users, Package, DollarSign, ShoppingCart, Lock, Building, Gift, Bell, UserPlus, Activity } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      const [
        { data: withdrawals },
        { data: deposits },
        { data: orders },
        { data: stakingOrders },
        { data: propertyInvestments },
        { data: p2pOrders },
        { data: kycRecords },
        { data: supportMessages },
      ] = await Promise.all([
        supabase.from('withdrawals').select('id, user_id, amount, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('deposits').select('id, user_id, amount, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('orders').select('id, user_id, product_name, amount, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('staking_orders').select('id, user_id, amount, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('property_investments').select('id, user_id, amount_paid, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('p2p_orders').select('id, user_id, crypto_amount, fiat_amount, type, status, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('kyc_verifications').select('id, user_id, status, id_type, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('messages').select('id, user_id, sender_id, body, read, created_at, profiles:user_id(name, email)').order('created_at', { ascending: false }).limit(6),
      ]);

      const all = [
        ...(withdrawals || []).map(w => ({ ...w, actType: 'withdrawal', actionTitle: 'Withdrawal Request', displayAmount: w.amount })),
        ...(deposits || []).map(d => ({ ...d, actType: 'deposit', actionTitle: 'Wallet Deposit', displayAmount: d.amount })),
        ...(orders || []).map(o => ({ ...o, actType: 'order', actionTitle: `Plan: ${o.product_name}`, displayAmount: o.amount })),
        ...(stakingOrders || []).map(s => ({ ...s, actType: 'staking', actionTitle: 'Locked Savings (Staking)', displayAmount: s.amount })),
        ...(propertyInvestments || []).map(p => ({ ...p, actType: 'property', actionTitle: 'Real Estate Purchase', displayAmount: p.amount_paid })),
        ...(p2pOrders || []).map(p => ({ ...p, actType: 'p2p', actionTitle: `P2P ${p.type.toUpperCase()}`, displayAmount: p.fiat_amount })),
        ...(kycRecords || []).map(k => ({ ...k, actType: 'kyc', actionTitle: `KYC: ${k.id_type || 'Identity Card'}` })),
        ...(supportMessages || []).map(m => ({ ...m, actType: 'support', actionTitle: `Support: ${m.body?.slice(0, 35)}...`, status: m.read ? 'read' : 'unread' })),
      ];

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(all.slice(0, 15));
    } catch (err) {
      console.error(err);
    }
  };

  // FIX: Replaced supabase.auth.admin.createUser() (requires service role key, cannot
  // be called from the browser) with a fetch to the create-user Edge Function which
  // runs server-side with the service role key.
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          name: newUser.name,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={() => setShowCreateUser(true)}
          className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl flex items-center gap-2 shrink-0"
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
          <Link to="/admin/logs" className="text-sm text-brand hover:underline font-bold">View all activity logs →</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity recorded.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => {
              const actType = item.actType || 'activity';
              const typeColorMap: Record<string, string> = {
                withdrawal: 'bg-red-50 text-red-600 border-red-100',
                deposit:    'bg-emerald-50 text-emerald-600 border-emerald-100',
                order:      'bg-blue-50 text-blue-600 border-blue-100',
                staking:    'bg-indigo-50 text-indigo-600 border-indigo-100',
                property:   'bg-orange-50 text-orange-600 border-orange-100',
                p2p:        'bg-teal-50 text-teal-700 border-teal-100',
                kyc:        'bg-yellow-50 text-yellow-800 border-yellow-100',
                support:    'bg-cyan-50 text-cyan-700 border-cyan-100',
              };

              return (
                <div key={`${actType}-${item.id}`} className="flex items-center justify-between border-b border-gray-100 pb-3 hover:bg-gray-50/50 p-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${typeColorMap[actType] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {actType}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.profiles?.name || item.profiles?.email || item.user_id}
                        <span className="text-gray-500 font-normal text-xs ml-2">· {item.actionTitle}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        {item.status && (
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                            item.status === 'pending' || item.status === 'unread'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'active' || item.status === 'confirmed' || item.status === 'approved' || item.status === 'read'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {item.status}
                          </span>
                        )}
                        {item.displayAmount !== undefined && (
                          <span className="font-bold text-gray-900">
                            {formatCurrency(item.displayAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              );
            })}
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
