import React, { useState } from 'react';
import { TrendingUp, Building2, ShieldCheck, ChevronDown, ChevronUp, Globe2, Activity } from 'lucide-react';

export const MacroMarketBriefingTicker: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);

  const metrics = [
    { label: 'Real Estate Cap Rate', val: '7.85% Net Dividend', change: '+0.3%', icon: <Building2 size={12} className="text-emerald-500" /> },
    { label: 'Prime Staking Index', val: '16.4% Compounded', change: 'Daily Payout', icon: <TrendingUp size={12} className="text-indigo-500" /> },
    { label: 'Deed Conveyance SLA', val: '15 Mins Settlement', change: 'Zero-Fee Escrow', icon: <ShieldCheck size={12} className="text-brand" /> },
    { label: '24h Global OTC Volume', val: '$2.84M USD', change: '100% Settled', icon: <Activity size={12} className="text-teal-500" /> },
  ];

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 text-xs shrink-0 select-none">
      {/* Ticker Bar */}
      <div className="px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Macro Desk</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-300 shrink-0">
            {metrics.map((m, idx) => (
              <React.Fragment key={m.label}>
                {idx > 0 && <span className="text-slate-700">•</span>}
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {m.icon}
                  <span className="text-slate-400">{m.label}:</span>
                  <span className="font-extrabold text-white">{m.val}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                    {m.change}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition shrink-0 ml-2"
          title={collapsed ? "Expand Macro Briefing" : "Collapse Macro Briefing"}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Expanded Macro Summary Card */}
      {!collapsed && (
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Globe2 size={13} className="text-indigo-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong className="text-slate-200">Executive Syndicate Briefing:</strong> Institutional real estate capital inflows remain buoyant. Rental yields across tokenized US residential holdings are averaging 9.2%–14.5% annual return with daily dividend settlement.
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono shrink-0 whitespace-nowrap">
            Refreshed Hourly • RPM Global Analytics
          </span>
        </div>
      )}
    </div>
  );
};
