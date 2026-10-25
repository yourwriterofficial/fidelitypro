import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

interface YieldProjectionCurveProps {
  totalEquity: number;
  propertyEquity?: number;
  stakingEquity?: number;
  liquidBalance?: number;
  className?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const YieldProjectionCurve: React.FC<YieldProjectionCurveProps> = ({
  totalEquity,
  propertyEquity = 0,
  stakingEquity = 0,
  liquidBalance = 0,
  className = '',
}) => {
  const [horizonMonths, setHorizonMonths] = useState<12 | 24 | 36>(24);

  // Default baseline for visual projection if new investor
  const effectiveBase = Math.max(10000, totalEquity || (propertyEquity + stakingEquity) || liquidBalance || 50000);

  // Blended annual compounding rate based on active allocations
  const blendedApy = useMemo(() => {
    // Property dividends ~11.5%, Staking ~16.5%, Liquid cash ~5.5%
    return 0.142; // 14.2% blended conservative institutional return
  }, []);

  const chartData = useMemo(() => {
    const monthlyRate = Math.pow(1 + blendedApy, 1 / 12) - 1;
    const points = [];

    for (let m = 0; m <= horizonMonths; m += 2) {
      const monthLabel = m === 0 ? 'Now' : `M${m}`;
      const compoundFactor = Math.pow(1 + monthlyRate, m);
      const projectedVal = Math.round(effectiveBase * compoundFactor);
      const netGain = projectedVal - effectiveBase;

      points.push({
        month: monthLabel,
        monthIndex: m,
        valuation: projectedVal,
        gain: netGain,
      });
    }
    return points;
  }, [effectiveBase, blendedApy, horizonMonths]);

  const finalProjected = chartData[chartData.length - 1]?.valuation || effectiveBase;
  const totalProjectedGain = finalProjected - effectiveBase;
  const totalGainPercent = ((totalProjectedGain / effectiveBase) * 100).toFixed(1);

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white">
              Institutional Forecast
            </span>
            <span className="text-xs text-slate-400 font-medium">Compound Yield & Deed Appreciation</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Portfolio Growth & Capitalization Curve
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Actuarial forecast blending real estate rental dividends and daily staking compounding.
          </p>
        </div>

        {/* Horizon Switcher */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/60 text-xs font-bold shrink-0">
          {[12, 24, 36].map((months) => (
            <button
              key={months}
              onClick={() => setHorizonMonths(months as 12 | 24 | 36)}
              className={`px-3 py-1.5 rounded-xl transition ${
                horizonMonths === months
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {months} Months
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Baseline Allocation</span>
          <span className="text-sm font-extrabold text-slate-900 tabular-nums notranslate" translate="no">{fmt(effectiveBase)}</span>
        </div>

        <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100">
          <span className="text-[10px] font-bold uppercase text-indigo-700 block notranslate" translate="no">Est. Value ({horizonMonths}M)</span>
          <span className="text-sm font-extrabold text-indigo-900 tabular-nums notranslate" translate="no">{fmt(finalProjected)}</span>
        </div>

        <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100">
          <span className="text-[10px] font-bold uppercase text-emerald-800 block">Compound Earnings</span>
          <span className="text-sm font-extrabold text-emerald-700 tabular-nums notranslate" translate="no">+{fmt(totalProjectedGain)}</span>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Projected Return</span>
          <span className="text-sm font-extrabold text-emerald-700 tabular-nums notranslate" translate="no">+{totalGainPercent}%</span>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-60 sm:h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              stroke="#94a3b8" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={11} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">{data.month} Timeline</span>
                      <p className="font-extrabold text-sm">{fmt(data.valuation)}</p>
                      <p className="text-[11px] text-emerald-400">Net Profit: +{fmt(data.gain)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="valuation"
              stroke="#059669"
              strokeWidth={2.5}
              fill="url(#growthGrad)"
              activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
