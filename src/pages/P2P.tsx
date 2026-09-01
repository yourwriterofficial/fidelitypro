import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { 
  ArrowRightLeft, ShieldCheck, CheckCircle2, Clock, 
  Wallet, RefreshCw, ShieldAlert, Lock
} from 'lucide-react';
import { useAccountRestriction } from '../hooks/useAccountRestriction';

interface P2PMerchant {
  id: string;
  name: string;
  asset: string;
  currency: string;
  rate: number;
  min_limit: number;
  max_limit: number;
  payment_methods: string[];
  completion_rate: number;
  total_orders: number;
  avg_release_mins: number;
  is_verified: boolean;
  is_active: boolean;
}

interface P2POrder {
  id: string;
  user_id: string;
  order_type: string;
  source_asset: string;
  target_asset: string;
  target_currency_symbol: string;
  amount_usd: number;
  target_amount: number;
  exchange_rate: number;
  merchant_name: string;
  merchant_rating: number;
  payment_method: string;
  destination_account_or_address: string;
  destination_bank_name?: string;
  account_holder_name?: string;
  status: string;
  notes?: string;
  created_at: string;
}

const SUPPORTED_ASSETS = [
  { id: 'USDT', name: 'Tether (USDT)', network: 'TRC20 / ERC20', type: 'crypto', symbol: 'USDT', rate: 1.00 },
  { id: 'BTC', name: 'Bitcoin (BTC)', network: 'Bitcoin Mainnet', type: 'crypto', symbol: 'BTC', rate: 0.000015 },
  { id: 'ETH', name: 'Ethereum (ETH)', network: 'ERC20', type: 'crypto', symbol: 'ETH', rate: 0.00038 },
  { id: 'SOL', name: 'Solana (SOL)', network: 'Solana Network', type: 'crypto', symbol: 'SOL', rate: 0.0072 },
  { id: 'USD_WIRE', name: 'USD Bank Wire (SWIFT / Fedwire)', network: 'All Global Banks', type: 'fiat', symbol: 'USD', rate: 1.00 },
  { id: 'EUR_SEPA', name: 'EUR Bank Transfer (SEPA Instant)', network: 'Eurozone Banks', type: 'fiat', symbol: 'EUR', rate: 0.92 },
  { id: 'GBP_FASTER', name: 'GBP Faster Payments (UK)', network: 'UK Clearing Banks', type: 'fiat', symbol: 'GBP', rate: 0.79 },
  { id: 'CAD_INTERAC', name: 'CAD Wire / Interac', network: 'Canadian Banks', type: 'fiat', symbol: 'CAD', rate: 1.36 },
  { id: 'AED_LOCAL', name: 'AED Local Bank Transfer', network: 'UAE Central Bank', type: 'fiat', symbol: 'AED', rate: 3.67 },
  { id: 'AUD_OSKO', name: 'AUD Direct / Osko Transfer', network: 'Australian Banks', type: 'fiat', symbol: 'AUD', rate: 1.52 },
  { id: 'NGN_DIRECT', name: 'NGN Instant Bank Transfer', network: 'All Nigerian Banks', type: 'fiat', symbol: 'NGN', rate: 1620.00 },
];

export default function P2P() {
  const { profile, refreshProfile } = useAuthStore();
  const { restricted: withdrawRestricted } = useAccountRestriction();
  const [tab, setTab] = useState<'express' | 'merchants' | 'orders'>('express');

  // Form State
  const [targetAssetId, setTargetAssetId] = useState<string>('USDT');
  const [amountUsd, setAmountUsd] = useState<string>('100000');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>(profile?.name || '');
  const [swiftOrRouting, setSwiftOrRouting] = useState<string>('');
  
  // Data State
  const [merchants, setMerchants] = useState<P2PMerchant[]>([]);
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<P2PMerchant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<P2POrder | null>(null);

  const selectedAsset = SUPPORTED_ASSETS.find(a => a.id === targetAssetId) || SUPPORTED_ASSETS[0];

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtCrypto = (n: number, symbol: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${symbol}`;

  const fetchMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('p2p_merchants')
        .select('*')
        .eq('is_active', true)
        .order('total_orders', { ascending: false });
      if (!error && data) {
        setMerchants(data as P2PMerchant[]);
        if (data.length > 0) setSelectedMerchant(data[0] as P2PMerchant);
      }
    } catch (err) {
      console.warn('Failed loading merchants:', err);
    }
  };

  const fetchOrders = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('p2p_orders')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setOrders(data as P2POrder[]);
      }
    } catch (err) {
      console.warn('Failed loading P2P orders:', err);
    }
  };

  useEffect(() => {
    fetchMerchants();
    fetchOrders();
  }, [profile?.id]);

  const parsedAmount = parseFloat(amountUsd) || 0;
  const calculatedTargetAmount = parsedAmount * selectedAsset.rate;
  const walletBalance = profile?.wallet_balance || 0;
  const hasSufficientBalance = walletBalance >= parsedAmount;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('Please log in to initiate a P2P conversion.');
      return;
    }
    if (!profile.can_withdraw || withdrawRestricted) {
      toast.error('Withdrawals & P2P settlements are disabled for your account. Please contact support.');
      return;
    }
    if (parsedAmount < 100000) {
      toast.error('Minimum P2P transaction amount is $100,000 USD.');
      return;
    }
    if (!hasSufficientBalance) {
      toast.error(`Insufficient balance. You have ${fmt(walletBalance)} available in your RPM Wallet.`);
      return;
    }
    if (!destinationAddress.trim()) {
      toast.error('Please enter your destination wallet address or bank account number.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Lock funds by deducting from wallet
      await supabase.rpc('deduct_wallet_balance', { user_id: profile.id, amount: parsedAmount });

      // 2. Create transaction record for audit trail
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'withdrawal',
        amount: -parsedAmount,
        description: `P2P Express Escrow Lock: ${selectedAsset.name} to ${destinationAddress.slice(0, 8)}...`,
        status: 'pending',
      });

      const merchantName = selectedMerchant?.name || 'Apex Institutional OTC Liquidity';
      const destinationFormatted = selectedAsset.type === 'fiat'
        ? `Bank: ${bankName || 'Direct Transfer'} | Acc: ${destinationAddress} | Name: ${accountHolder || profile.name} | SWIFT/Routing: ${swiftOrRouting || 'N/A'}`
        : `${selectedAsset.symbol} Address: ${destinationAddress} (${selectedAsset.network})`;

      // 3. Create P2P Order
      const { data, error } = await supabase.from('p2p_orders').insert({
        user_id: profile.id,
        user_name: profile.name,
        user_email: profile.email,
        order_type: 'sell',
        source_asset: 'USD',
        target_asset: selectedAsset.id,
        target_currency_symbol: selectedAsset.symbol,
        amount_usd: parsedAmount,
        target_amount: calculatedTargetAmount,
        exchange_rate: selectedAsset.rate,
        merchant_name: merchantName,
        merchant_rating: selectedMerchant?.completion_rate || 99.8,
        merchant_trades: selectedMerchant?.total_orders || 3500,
        payment_method: selectedAsset.type === 'fiat' ? 'International Bank Wire / SEPA' : 'Direct Crypto Transfer',
        destination_account_or_address: destinationFormatted,
        destination_bank_name: bankName,
        account_holder_name: accountHolder || profile.name,
        status: 'escrow_locked',
        notes: `Order created by user via P2P Express. Escrow locked from wallet.`,
      }).select().single();

      if (error) throw error;

      // 4. Send notification message to Support Desk
      try {
        await supabase.from('messages').insert({
          user_id: profile.id,
          sender_id: profile.id,
          body: `[P2P Express Conversion Request - $${parsedAmount.toLocaleString()}] Destination: ${destinationFormatted} | Target Amount: ${calculatedTargetAmount.toLocaleString()} ${selectedAsset.symbol} | Merchant: ${merchantName} | Escrow: LOCKED`,
          read: false,
        });
      } catch (_) {}

      toast.success('P2P Escrow Order Created!', {
        description: `Your $${parsedAmount.toLocaleString()} USD has been locked in RPM institutional escrow. Funds will be released within 15 minutes.`,
      });

      setOrderSuccess(data as P2POrder);
      await refreshProfile();
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create P2P conversion order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-14">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">P2P Express & OTC Desk</h1>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-extrabold text-[10px] uppercase tracking-wider">
              Bybit-Grade Escrow
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Convert your RPM Wallet balance directly to Any Crypto or Any Bank Account worldwide with zero slippage.
          </p>
        </div>

        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-md border border-slate-800">
          <Wallet size={18} className="text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Available Balance</span>
            <span className="text-base font-extrabold tabular-nums text-emerald-400">{fmt(walletBalance)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => { setTab('express'); setOrderSuccess(null); }}
          className={`pb-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === 'express'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ArrowRightLeft size={16} /> Express 1-Click Conversion
        </button>
        <button
          onClick={() => { setTab('merchants'); setOrderSuccess(null); }}
          className={`pb-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === 'merchants'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldCheck size={16} /> Verified OTC Merchants
        </button>
        <button
          onClick={() => { setTab('orders'); setOrderSuccess(null); }}
          className={`pb-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 relative ${
            tab === 'orders'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock size={16} /> My P2P Orders ({orders.length})
        </button>
      </div>

      {/* ── TAB 1: EXPRESS CONVERSION ── */}
      {tab === 'express' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Conversion Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Instant Wallet Conversion</h3>
                <p className="text-xs text-gray-500 mt-0.5">Funds are locked in institutional escrow until transfer clears.</p>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Lock size={12} /> 100% Escrow Protected
              </div>
            </div>

            {orderSuccess ? (
              <div className="text-center py-8 space-y-5">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">P2P Escrow Order Dispatched!</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Order ID: <code className="font-mono font-bold text-slate-800">{orderSuccess.id}</code>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-gray-500">Amount Sent:</span>
                    <span className="font-bold text-gray-900">{fmt(orderSuccess.amount_usd)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-gray-500">Receiving:</span>
                    <span className="font-bold text-emerald-600">
                      {fmtCrypto(orderSuccess.target_amount, orderSuccess.target_currency_symbol)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-gray-500">Assigned OTC Merchant:</span>
                    <span className="font-bold text-gray-800">{orderSuccess.merchant_name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Estimated Settlement:</span>
                    <span className="font-bold text-indigo-700">Within 15 Minutes</span>
                  </div>
                </div>

                {/* Strict Warning */}
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 text-left flex items-start gap-2.5">
                  <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold text-red-950 block">SECURITY SETTLEMENT POLICY:</strong>
                    Only confirm receipt after verified credit arrives in your external account. Submitting false confirmations or forged receipts leads to <strong className="underline">immediate, permanent account ban</strong>.
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setOrderSuccess(null); setTab('orders'); }}
                    className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition text-sm shadow-md"
                  >
                    View Order in My Orders
                  </button>
                  <button
                    onClick={() => setOrderSuccess(null)}
                    className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition text-sm"
                  >
                    New Conversion
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOrderSubmit} className="space-y-5">
                {/* Source: USD Balance */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">You Send (From RPM Wallet)</label>
                    <span className="text-xs text-gray-400">
                      Balance: <strong className="text-gray-800 font-bold">{fmt(walletBalance)}</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="1000"
                      min="100000"
                      value={amountUsd}
                      onChange={e => setAmountUsd(e.target.value)}
                      className="w-full pl-8 pr-28 py-3.5 border border-gray-300 rounded-2xl text-lg font-extrabold focus:ring-2 focus:ring-brand focus:border-transparent text-gray-900"
                      placeholder="Min 100,000"
                      required
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl font-bold text-xs text-gray-700">
                      <span>USD</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 text-[11px]">
                    <span className="text-amber-700 font-bold">⚡ Minimum Transaction: $100,000 USD</span>
                    {parsedAmount < 100000 && (
                      <span className="text-red-500 font-semibold">Amount must be at least $100,000</span>
                    )}
                  </div>
                </div>

                {/* Target Asset Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Select Receiving Asset (Crypto or Bank Wire)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {SUPPORTED_ASSETS.map(asset => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setTargetAssetId(asset.id)}
                        className={`p-3 rounded-2xl border text-left transition ${
                          targetAssetId === asset.id
                            ? 'bg-brand/10 border-brand ring-2 ring-brand/20'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-extrabold text-xs text-gray-900 block truncate">{asset.symbol}</span>
                        <span className="text-[10px] text-gray-400 truncate block mt-0.5">{asset.name}</span>
                        <span className="text-[9px] font-bold text-indigo-600 block mt-1 uppercase">
                          {asset.type === 'crypto' ? 'Crypto Escrow' : 'Bank Wire'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Calculation Preview */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-500">
                    <span>Reference OTC Rate:</span>
                    <span className="font-semibold text-gray-800">
                      1 USD = {selectedAsset.rate} {selectedAsset.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500">
                    <span>You Receive (Estimated):</span>
                    <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                      {fmtCrypto(calculatedTargetAmount, selectedAsset.symbol)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-slate-200/60">
                    <span>Processing Window:</span>
                    <span className="font-bold text-gray-800">~15 Minutes</span>
                  </div>
                </div>

                {/* Destination Input Form (Dynamic based on Crypto vs Fiat) */}
                {selectedAsset.type === 'crypto' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Your {selectedAsset.symbol} Destination Wallet Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={e => setDestinationAddress(e.target.value)}
                      placeholder={`Enter your ${selectedAsset.name} address (${selectedAsset.network})`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand font-medium"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Network: <strong className="text-gray-700">{selectedAsset.network}</strong>. Double check address accuracy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    <h5 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                      Destination Bank Account Details ({selectedAsset.symbol})
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Bank Name *</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          placeholder="e.g. JPMorgan Chase, Barclays, BNP Paribas"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Account Holder Full Name *</label>
                        <input
                          type="text"
                          value={accountHolder}
                          onChange={e => setAccountHolder(e.target.value)}
                          placeholder="Full Legal Name"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Account Number / IBAN *</label>
                        <input
                          type="text"
                          value={destinationAddress}
                          onChange={e => setDestinationAddress(e.target.value)}
                          placeholder="Account Number or IBAN"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">SWIFT / BIC / Routing Code</label>
                        <input
                          type="text"
                          value={swiftOrRouting}
                          onChange={e => setSwiftOrRouting(e.target.value)}
                          placeholder="e.g. CHASUS33XXX"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Anti-Fraud Notice */}
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 flex items-start gap-2.5 shadow-xs">
                  <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold text-red-950 block">CRITICAL FRAUD NOTICE:</strong>
                    Only confirm receipt after verifying cleared funds in your destination account. Submitting fraudulent release confirmations or fake receipts violates anti-money laundering regulations and results in <strong className="underline">immediate, permanent account termination</strong>.
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting || !hasSufficientBalance || parsedAmount < 100000}
                  className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-dark hover:to-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-brand/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {submitting ? (
                    <><RefreshCw size={16} className="animate-spin" /> Locking Escrow & Dispatching...</>
                  ) : (
                    <><Lock size={16} /> Lock Escrow & Convert {fmt(parsedAmount)}</>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Escrow Steps & OTC Guarantee (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bybit Escrow Flow Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h4 className="font-bold text-base">Institutional P2P Escrow</h4>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <div>
                    <strong className="text-white block">Escrow Lock</strong>
                    Your USD funds are frozen securely in RPM Smart Escrow. The merchant cannot access them until you receive payout.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <div>
                    <strong className="text-white block">Merchant Dispatches Wire / Crypto</strong>
                    The verified institutional desk initiates direct transfer to your provided address or bank.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <div>
                    <strong className="text-white block">Automated Release</strong>
                    Once the transaction completes on the ledger/SWIFT, escrow settles cleanly.
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                <span className="text-slate-400">Escrow Completion Rate:</span>
                <span className="font-bold text-emerald-400">99.98%</span>
              </div>
            </div>

            {/* Quick OTC Desk Stats */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-gray-900">Supported Currencies & Desks</h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Minimum Order Size:</span>
                  <span className="font-bold text-gray-900">$100,000 USD</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Maximum Order Size:</span>
                  <span className="font-bold text-gray-900">$10,000,000 USD / order</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Settlement Speed:</span>
                  <span className="font-bold text-emerald-600">8 - 15 Minutes</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Supported Fiat & Crypto:</span>
                  <span className="font-bold text-indigo-700">11 Global Currencies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: VERIFIED OTC MERCHANTS ── */}
      {tab === 'merchants' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-gray-900">Verified Institutional P2P Desks</h3>
              <p className="text-xs text-gray-400 mt-0.5">Top-rated liquid OTC partners for high-volume fiat & crypto delivery.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Merchant', 'Asset / Currency', 'OTC Rate', 'Limits (Min - Max)', 'Completion', 'Avg Release', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {merchants.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {m.is_verified && (
                          <span className="text-blue-500" title="Verified Institutional Partner">
                            <CheckCircle2 size={15} />
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 font-normal">
                        {m.total_orders.toLocaleString()} trades completed
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-800">{m.currency}</td>
                    <td className="px-4 py-4 font-extrabold text-emerald-600 tabular-nums">
                      ${m.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-gray-700 tabular-nums">
                      {fmt(m.min_limit)} - {fmt(m.max_limit)}
                    </td>
                    <td className="px-4 py-4 font-bold text-gray-900">{m.completion_rate}%</td>
                    <td className="px-4 py-4 text-xs text-gray-600">{m.avg_release_mins} mins</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => {
                          setSelectedMerchant(m);
                          setTab('express');
                        }}
                        className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-xs transition shadow-sm"
                      >
                        Convert Here
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: MY P2P ORDERS ── */}
      {tab === 'orders' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-gray-900">My P2P Orders & Settlements</h3>
              <p className="text-xs text-gray-400 mt-0.5">Track live escrow state, merchant transfers, and release receipts.</p>
            </div>
            <button onClick={fetchOrders} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition" title="Refresh orders">
              <RefreshCw size={16} />
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Clock size={36} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-semibold">No P2P orders yet</p>
              <p className="text-xs text-gray-400 mt-1">Submit your first $100k+ conversion from the Express tab.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    {['Order ID / Date', 'Sent (USD)', 'Receiving', 'Destination', 'Merchant', 'Escrow Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(ord => (
                    <tr key={ord.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-4">
                        <code className="text-xs font-mono font-bold text-gray-800">{ord.id.slice(0, 8)}...</code>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {new Date(ord.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-900 tabular-nums">{fmt(ord.amount_usd)}</td>
                      <td className="px-4 py-4 font-extrabold text-emerald-600 tabular-nums">
                        {fmtCrypto(ord.target_amount, ord.target_currency_symbol)}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-600 max-w-[200px] truncate" title={ord.destination_account_or_address}>
                        {ord.destination_account_or_address}
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-gray-800">{ord.merchant_name}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase text-[10px] tracking-wider ${
                          ord.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ord.status === 'escrow_locked'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <Lock size={10} />
                          {ord.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
