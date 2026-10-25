import React from 'react';
import { 
  X, ShieldCheck, CheckCircle2, Clock, Lock, ArrowRight, 
  MessageSquare, Copy 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export interface P2POrderDetails {
  id: string;
  source_asset?: string;
  target_asset: string;
  target_currency_symbol: string;
  amount_usd: number;
  target_amount: number;
  merchant_name: string;
  destination_account_or_address: string;
  status: string;
  created_at: string;
}

interface P2PEscrowStepperModalProps {
  order: P2POrderDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const P2PEscrowStepperModal: React.FC<P2PEscrowStepperModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const isCompleted = order.status === 'completed';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Institutional P2P Escrow Stepper</h3>
              <p className="text-xs text-slate-300">Live multi-signature escrow & counterparty settlement state</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Order Metrics Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
              <span className="text-slate-500 font-medium">Escrow Order Reference</span>
              <div className="flex items-center gap-1.5">
                <code className="font-mono font-bold text-slate-800 text-[11px]">{order.id}</code>
                <button
                  onClick={() => copyToClipboard(order.id, 'Order ID')}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                  title="Copy Order ID"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Funds in Escrow</span>
                <span className="text-sm font-extrabold text-slate-900 tabular-nums">{fmt(order.amount_usd)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatched Payout</span>
                <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                  {order.target_amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {order.target_currency_symbol}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 text-[11px] flex justify-between items-center text-slate-500">
              <span>Authorized Merchant: <strong className="text-slate-800">{order.merchant_name}</strong></span>
              <span className="text-slate-400 font-mono">SLA: ~15 mins</span>
            </div>
          </div>

          {/* 3-Step Live Progress Stepper */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Settlement Protocol Progression
            </h4>

            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {/* Step 1: Escrow Vault Lock */}
              <div className="flex items-start gap-3.5 relative">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm z-10">
                  <CheckCircle2 size={15} />
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex-1 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950">1. Escrow Vault Locked</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-full">
                      Secured
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Your USD funds are frozen in the immutable RPM escrow vault. Counterparty cannot claim until delivery confirmation.
                  </p>
                </div>
              </div>

              {/* Step 2: Merchant Dispatch & Blockchain/Wire Transit */}
              <div className="flex items-start gap-3.5 relative">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 ${
                  isCompleted 
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-indigo-600 text-white animate-pulse shadow-md shadow-indigo-600/30'
                }`}>
                  {isCompleted ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                </div>
                <div className={`p-3.5 rounded-2xl border flex-1 text-xs space-y-1 ${
                  isCompleted
                    ? 'bg-emerald-50/70 border-emerald-100'
                    : 'bg-indigo-50/60 border-indigo-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold ${isCompleted ? 'text-emerald-950' : 'text-indigo-950'}`}>
                      2. Counterparty Transfer in Transit
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      isCompleted 
                        ? 'text-emerald-700 bg-emerald-100/80' 
                        : 'text-indigo-700 bg-indigo-100 animate-pulse'
                    }`}>
                      {isCompleted ? 'Confirmed' : 'Active Dispatch'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {order.merchant_name} is releasing {order.target_currency_symbol} to your destination: <code className="font-mono text-slate-800 font-bold break-all">{order.destination_account_or_address}</code>.
                  </p>
                </div>
              </div>

              {/* Step 3: Ledger Settlement & Escrow Release */}
              <div className="flex items-start gap-3.5 relative">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 ${
                  isCompleted 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <Lock size={13} />
                </div>
                <div className={`p-3.5 rounded-2xl border flex-1 text-xs space-y-1 ${
                  isCompleted
                    ? 'bg-emerald-50/70 border-emerald-100'
                    : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold ${isCompleted ? 'text-emerald-950' : 'text-slate-700'}`}>
                      3. Settlement & Release
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      isCompleted ? 'text-emerald-700 bg-emerald-100' : 'text-slate-500 bg-slate-200/70'
                    }`}>
                      {isCompleted ? 'Settled' : 'Pending Final Receipt'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Upon arrival of wire/blockchain tx confirmation, the escrow cycle finishes with zero counterparty risk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support Concierge Footer */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <MessageSquare size={15} className="text-brand shrink-0" />
              <span>Need help or want to expedite escrow?</span>
            </div>
            <Link
              to="/app/chat?tab=support"
              onClick={onClose}
              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              <span>Message 24/7 Escrow Support</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
