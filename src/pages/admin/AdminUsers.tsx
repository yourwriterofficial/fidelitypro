import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Ban, UserCheck, Eye, Edit, Plus, Minus, RefreshCw, Save, X, 
  ChevronDown, ChevronUp, Mail, Lock, AlertCircle, DollarSign 
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
  is_admin: boolean;
  banned: boolean;
  ban_reason: string;
  can_withdraw: boolean;
  can_invest: boolean;
  can_stake: boolean;
  can_property: boolean;
  restriction_reason: string;
  fee_required: number;
  created_at: string;
}

interface Investment {
  id: string;
  product_name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface StakingOrder {
  id: string;
  amount: number;
  apy: number;
  lock_days: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface PropertyInvestment {
  id: string;
  property_title: string;
  amount_paid: number;
  remaining_balance: number;
  status: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [editData, setEditData] = useState<Partial<User>>({});
  const [topupAmount, setTopupAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stakingOrders, setStakingOrders] = useState<StakingOrder[]>([]);
  const [propertyInvestments, setPropertyInvestments] = useState<PropertyInvestment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load users');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    setEditData({
      name: user.name,
      email: user.email,
      is_admin: user.is_admin,
      banned: user.banned,
      ban_reason: user.ban_reason,
      can_withdraw: user.can_withdraw,
      can_invest: user.can_invest,
      can_stake: user.can_stake,
      can_property: user.can_property,
      restriction_reason: user.restriction_reason || '',
      fee_required: user.fee_required || 0,
    });
    setTopupAmount('');
    setDeductAmount('');
    setActiveTab('profile');
    setModalOpen(true);
    await fetchUserDetails(user.id);
  };

  const fetchUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const { data: invData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setInvestments(invData || []);

      const { data: stakingData } = await supabase
        .from('staking_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setStakingOrders(stakingData || []);

      const { data: propData } = await supabase
        .from('property_investments')
        .select('*, property:property_id(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPropertyInvestments(propData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const saveProfile = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editData.name,
          is_admin: editData.is_admin,
          banned: editData.banned,
          ban_reason: editData.ban_reason,
          can_withdraw: editData.can_withdraw,
          can_invest: editData.can_invest,
          can_stake: editData.can_stake,
          can_property: editData.can_property,
          restriction_reason: editData.restriction_reason,
          fee_required: editData.fee_required,
        })
        .eq('id', selectedUser.id);
      if (error) throw error;
      toast.success('Profile updated');
      fetchUsers();
      setSelectedUser({ ...selectedUser, ...editData });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTopup = async () => {
    if (!selectedUser) return;
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await supabase.rpc('add_wallet_balance', { user_id: selectedUser.id, amount });
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        type: 'admin',
        amount,
        description: 'Admin wallet top-up',
        status: 'completed',
      });
      toast.success(`Added $${amount} to wallet`);
      setTopupAmount('');
      await fetchUsers();
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeduct = async () => {
    if (!selectedUser) return;
    const amount = parseFloat(deductAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (selectedUser.wallet_balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      await supabase.rpc('deduct_wallet_balance', { user_id: selectedUser.id, amount });
      await supabase.from('transactions').insert({
        user_id: selectedUser.id,
        type: 'admin',
        amount: -amount,
        description: 'Admin wallet deduction',
        status: 'completed',
      });
      toast.success(`Deducted $${amount} from wallet`);
      setDeductAmount('');
      await fetchUsers();
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const sendEmail = async () => {
    if (!selectedUser) return;
    if (!emailSubject || !emailMessage) {
      toast.error('Subject and message required');
      return;
    }
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: selectedUser.email,
          subject: emailSubject,
          html: `<p>${emailMessage.replace(/\n/g, '<br>')}</p>`,
        },
      });
      if (error) throw error;
      toast.success('Email sent');
      setEmailSubject('');
      setEmailMessage('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase.auth.admin.resetPasswordForEmail(selectedUser.email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateInvestmentStatus = async (investmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', investmentId);
      if (error) throw error;
      toast.success('Investment updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateStakingStatus = async (stakingId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('staking_orders').update({ status: newStatus }).eq('id', stakingId);
      if (error) throw error;
      toast.success('Staking order updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updatePropertyStatus = async (propertyId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('property_investments').update({ status: newStatus }).eq('id', propertyId);
      if (error) throw error;
      toast.success('Property investment updated');
      if (selectedUser) await fetchUserDetails(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const impersonateUser = (user: User) => {
    const { impersonateUser } = useAuthStore.getState();
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      wallet_balance: user.wallet_balance,
      is_admin: user.is_admin,
      banned: user.banned,
      can_withdraw: user.can_withdraw,
      can_invest: user.can_invest,
      can_stake: user.can_stake,
      can_property: user.can_property,
      restriction_reason: user.restriction_reason,
      fee_required: user.fee_required,
    };
    impersonateUser(profile);
    navigate('/app');
    toast.success(`Impersonating ${user.name || user.email}`);
  };

  const toggleBan = async (userId: string, banned: boolean) => {
    const newStatus = !banned;
    const reason = newStatus ? prompt('Ban reason:') : '';
    if (newStatus && !reason) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ banned: newStatus, ban_reason: reason || null })
        .eq('id', userId);
      if (error) throw error;
      toast.success(newStatus ? 'User banned' : 'User unbanned');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Users</h1>
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Balance</th>
                <th className="text-left p-4">Admin</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">{u.name}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4">{formatCurrency(u.wallet_balance)}</td>
                  <td className="p-4">{u.is_admin ? 'Yes' : 'No'}</td>
                  <td className="p-4">
                    {u.banned ? (
                      <span className="text-red-600 text-xs font-medium">Banned</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="p-4 space-x-2 whitespace-nowrap">
                    <button onClick={() => openUserModal(u)} className="text-blue-600 hover:text-blue-800" title="Edit user">
                      <Edit size={18} />
                    </button>
                    {!u.is_admin && (
                      <button onClick={() => toggleBan(u.id, u.banned)} className="text-red-600 hover:text-red-800" title={u.banned ? 'Unban' : 'Ban'}>
                        {u.banned ? <UserCheck size={18} /> : <Ban size={18} />}
                      </button>
                    )}
                    <button onClick={() => impersonateUser(u)} className="text-purple-600 hover:text-purple-800" title="Impersonate user">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="p-8 text-gray-500 text-center">No users.</p>}
      </div>

      {/* Edit User Modal */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit User: {selectedUser.name || selectedUser.email}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
              {['profile', 'restrictions', 'wallet', 'investments', 'staking', 'properties', 'actions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={editData.email || ''}
                    disabled
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed directly. Use Supabase Auth.</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.is_admin || false}
                      onChange={(e) => setEditData({ ...editData, is_admin: e.target.checked })}
                    />
                    Admin
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.banned || false}
                      onChange={(e) => setEditData({ ...editData, banned: e.target.checked })}
                    />
                    Banned
                  </label>
                </div>
                {editData.banned && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ban Reason</label>
                    <input
                      type="text"
                      value={editData.ban_reason || ''}
                      onChange={(e) => setEditData({ ...editData, ban_reason: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                    />
                  </div>
                )}
                <button onClick={saveProfile} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-xl flex items-center gap-2">
                  <Save size={18} /> Save Profile
                </button>
              </div>
            )}

            {activeTab === 'restrictions' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_withdraw !== false}
                      onChange={(e) => setEditData({ ...editData, can_withdraw: e.target.checked })}
                    />
                    Allow Withdrawals
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_invest !== false}
                      onChange={(e) => setEditData({ ...editData, can_invest: e.target.checked })}
                    />
                    Allow Invest
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_stake !== false}
                      onChange={(e) => setEditData({ ...editData, can_stake: e.target.checked })}
                    />
                    Allow Staking
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editData.can_property !== false}
                      onChange={(e) => setEditData({ ...editData, can_property: e.target.checked })}
                    />
                    Allow Property Investment
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Restriction Reason</label>
                  <input
                    type="text"
                    value={editData.restriction_reason || ''}
                    onChange={(e) => setEditData({ ...editData, restriction_reason: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                    placeholder="e.g., Requires deposit of $50 to unlock"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fee Required ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.fee_required || 0}
                    onChange={(e) => setEditData({ ...editData, fee_required: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-xs text-gray-400 mt-1">User must deposit this amount before restrictions are lifted.</p>
                </div>
                <button onClick={saveProfile} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-xl flex items-center gap-2">
                  <Save size={18} /> Save Restrictions
                </button>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(selectedUser.wallet_balance || 0)}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Top-up Amount</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                        placeholder="50.00"
                      />
                      <button onClick={handleTopup} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl flex items-center gap-1">
                        <Plus size={18} /> Add
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Deduct Amount</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={deductAmount}
                        onChange={(e) => setDeductAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                        placeholder="25.00"
                      />
                      <button onClick={handleDeduct} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-1">
                        <Minus size={18} /> Deduct
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'investments' && (
              <div>
                {loadingDetails ? (
                  <p>Loading investments...</p>
                ) : investments.length === 0 ? (
                  <p className="text-gray-500">No investments.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Plan</th>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">Daily %</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {investments.map((inv) => (
                          <tr key={inv.id} className="border-t">
                            <td className="p-2">{inv.product_name}</td>
                            <td className="p-2">{formatCurrency(inv.amount)}</td>
                            <td className="p-2">{inv.daily_return}%</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                inv.status === 'active' ? 'bg-green-100 text-green-700' :
                                inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{inv.status}</span>
                            </td>
                            <td className="p-2">
                              <select
                                value={inv.status}
                                onChange={(e) => updateInvestmentStatus(inv.id, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'staking' && (
              <div>
                {loadingDetails ? (
                  <p>Loading staking orders...</p>
                ) : stakingOrders.length === 0 ? (
                  <p className="text-gray-500">No staking orders.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">APY</th>
                        <th className="p-2 text-left">Lock Days</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {stakingOrders.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{formatCurrency(s.amount)}</td>
                            <td className="p-2">{s.apy}%</td>
                            <td className="p-2">{s.lock_days}d</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                s.status === 'active' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{s.status}</span>
                            </td>
                            <td className="p-2">
                              <select
                                value={s.status}
                                onChange={(e) => updateStakingStatus(s.id, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="withdrawn_early">Withdrawn Early</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'properties' && (
              <div>
                {loadingDetails ? (
                  <p>Loading property investments...</p>
                ) : propertyInvestments.length === 0 ? (
                  <p className="text-gray-500">No property investments.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="p-2 text-left">Property</th>
                        <th className="p-2 text-left">Paid</th>
                        <th className="p-2 text-left">Remaining</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Action</th>
                      </tr></thead>
                      <tbody>
                        {propertyInvestments.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{p.property?.title || 'N/A'}</td>
                            <td className="p-2">{formatCurrency(p.amount_paid)}</td>
                            <td className="p-2">{formatCurrency(p.remaining_balance)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                p.status === 'active' ? 'bg-green-100 text-green-700' :
                                p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{p.status}</span>
                            </td>
                            <td className="p-2">
                              <select
                                value={p.status}
                                onChange={(e) => updatePropertyStatus(p.id, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="defaulted">Defaulted</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Send Email</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                      placeholder="Subject"
                    />
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                      placeholder="Message..."
                    />
                    <button
                      onClick={sendEmail}
                      disabled={sendingEmail}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-70"
                    >
                      <Mail size={18} /> {sendingEmail ? 'Sending...' : 'Send Email'}
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Account Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={resetPassword}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                    >
                      <Lock size={18} /> Reset Password
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete user ${selectedUser.name || selectedUser.email}?`)) {
                          // Delete user (admin only)
                          supabase.auth.admin.deleteUser(selectedUser.id).then(({ error }) => {
                            if (error) toast.error(error.message);
                            else {
                              toast.success('User deleted');
                              setModalOpen(false);
                              fetchUsers();
                            }
                          });
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                    >
                      <Ban size={18} /> Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}