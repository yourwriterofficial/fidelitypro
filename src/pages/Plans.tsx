import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Home, Layers, ArrowLeftRight, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';

export default function Plans() {
  const [activeTab, setActiveTab] = useState<'all' | 'properties' | 'staking' | 'p2p' | 'invest'>('all');

  const investmentPlans = [
    { name: 'Starter Plan', min: 100, max: 4999, dailyReturn: 3.0, duration: 30, popular: false },
    { name: 'Growth Standard', min: 5000, max: 49999, dailyReturn: 5.0, duration: 60, popular: true },
    { name: 'Institutional Premium', min: 50000, max: 500000, dailyReturn: 8.0, duration: 90, popular: false },
  ];

  const stakingPlans = [
    { name: 'Flexible Sprint', term: '7 Days', apy: 9.5, min: '$50', desc: 'Short-term high liquidity lock with fast payout' },
    { name: 'Monthly Growth', term: '30 Days', apy: 12.0, min: '$100', desc: 'Optimal monthly savings compounding with fixed return' },
    { name: 'Quarterly Builder', term: '90 Days', apy: 15.0, min: '$250', desc: 'Accelerated quarterly yield with guaranteed principal' },
    { name: 'Annual Vault', term: '365 Days', apy: 18.0, min: '$500', desc: 'Maximum compounding APY with dedicated account advisor' },
  ];

  const propertyTiers = [
    {
      type: 'Fractional Share Entry',
      min: '$500',
      avgYield: '9.0% – 12.0%',
      desc: 'Buy fractional deed shares in prime residential real estate complexes',
      payout: 'Monthly Rental Dividends',
      term: 'Liquid - Tradeable Anytime'
    },
    {
      type: 'Commercial Real Estate',
      min: '$2,500',
      avgYield: '11.5% – 14.5%',
      desc: 'High-traffic commercial and office property assets with multi-year lease tenants',
      payout: 'Quarterly Cash Flow + Capital Growth',
      term: 'Independent Appraisal Audits'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Transparent Product Catalog
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Plans & Asset Offerings
          </h1>
          <p className="text-gray-600 mt-4 text-base sm:text-lg leading-relaxed">
            Choose how you want to build wealth: Real Estate Fractional Shares, Guaranteed Locked Savings, Zero-fee P2P Trading, or Managed Daily Yield Plans.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center flex-wrap gap-2.5 mb-12">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'properties', label: 'Real Estate Properties', icon: <Home size={15} /> },
            { id: 'staking', label: 'Locked Savings (Staking)', icon: <Layers size={15} /> },
            { id: 'p2p', label: 'P2P Marketplace', icon: <ArrowLeftRight size={15} /> },
            { id: 'invest', label: 'Investment Plans', icon: <TrendingUp size={15} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border ${
                activeTab === t.id
                  ? 'bg-brand text-white border-brand shadow-md shadow-brand/20'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-brand hover:text-brand'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* SECTION 1: Real Estate Properties */}
        {(activeTab === 'all' || activeTab === 'properties') && (
          <div className="mb-14">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Home size={18} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Real Estate Property Shares</h2>
                  <p className="text-xs text-gray-500">Own fractional deeds with automated rental dividends</p>
                </div>
              </div>
              <Link to="/app/properties" className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1">
                Browse Marketplace <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {propertyTiers.map((p, i) => (
                <div key={i} className="bg-white rounded-3xl border border-amber-200/80 p-8 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100 mb-3 inline-block">
                      Min Investment: {p.min}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{p.type}</h3>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">{p.desc}</p>
                    
                    <div className="space-y-2.5 my-6 pt-4 border-t border-gray-100 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Target Annual Yield</span>
                        <span className="font-extrabold text-amber-700 text-sm">{p.avgYield}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Payout Schedule</span>
                        <span className="font-semibold text-gray-800">{p.payout}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Deed Verification</span>
                        <span className="font-semibold text-gray-800">{p.term}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/app/properties"
                    className="w-full text-center bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-sm"
                  >
                    View Property Listings
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: Staking / Locked Savings */}
        {(activeTab === 'all' || activeTab === 'staking') && (
          <div className="mb-14">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Layers size={18} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Locked Savings (Staking APY)</h2>
                  <p className="text-xs text-gray-500">Fixed terms with 100% guaranteed principal return</p>
                </div>
              </div>
              <Link to="/app/staking" className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1">
                View Staking Portal <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {stakingPlans.map((s, i) => (
                <div key={i} className="bg-white rounded-3xl border border-indigo-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        {s.term}
                      </span>
                      <span className="text-xs font-medium text-gray-400">Min {s.min}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mt-2">{s.name}</h3>
                    <div className="my-4">
                      <span className="text-3xl font-extrabold text-indigo-600">{s.apy}%</span>
                      <span className="text-xs text-gray-400 ml-1">Fixed APY</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">{s.desc}</p>
                  </div>
                  <Link
                    to="/app/staking"
                    className="w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                  >
                    Lock Funds Now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: P2P Marketplace */}
        {(activeTab === 'all' || activeTab === 'p2p') && (
          <div className="mb-14">
            <div className="bg-gradient-to-r from-teal-900 via-teal-850 to-gray-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-teal-300 mb-3">
                  <ArrowLeftRight size={14} /> P2P Escrow Exchange
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">Trade USDT Peer-to-Peer at 0% Fee</h2>
                <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                  Post your own prices or fill active buy/sell requests with verified investors. Zero exchange commissions, fast automated escrow releases.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-gray-400 block">Platform Fee</span>
                    <span className="font-extrabold text-teal-300 text-sm">0.00%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Escrow Security</span>
                    <span className="font-extrabold text-white text-sm">100% Protected</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Average Match</span>
                    <span className="font-extrabold text-teal-300 text-sm">&lt; 5 Minutes</span>
                  </div>
                </div>
              </div>
              <Link
                to="/app/p2p"
                className="shrink-0 bg-teal-500 hover:bg-teal-400 text-gray-900 font-extrabold px-8 py-4 rounded-2xl text-sm transition shadow-lg"
              >
                Go to P2P Marketplace →
              </Link>
            </div>
          </div>
        )}

        {/* SECTION 4: Managed Investment Plans */}
        {(activeTab === 'all' || activeTab === 'invest') && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-brand flex items-center justify-center font-bold">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Managed Investment ROI Plans</h2>
                  <p className="text-xs text-gray-500">Daily returns with algorithmic capital management</p>
                </div>
              </div>
              <Link to="/app/invest" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                Calculate Returns <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {investmentPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white rounded-3xl border p-8 shadow-sm hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between ${
                    plan.popular ? 'border-brand ring-2 ring-brand/20 shadow-md' : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-sm">
                      Most Popular Plan
                    </span>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="my-4">
                      <span className="text-4xl font-extrabold text-brand">{plan.dailyReturn}%</span>
                      <span className="text-xs text-gray-400 ml-1">daily ROI</span>
                    </div>
                    <ul className="space-y-3 text-xs text-gray-600 mb-6">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="text-brand shrink-0" size={16} /> Minimum: ${plan.min.toLocaleString()}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="text-brand shrink-0" size={16} /> Maximum: ${plan.max.toLocaleString()}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="text-brand shrink-0" size={16} /> Duration: {plan.duration} Days
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="text-brand shrink-0" size={16} /> 100% Principal Protection
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="text-brand shrink-0" size={16} /> Daily automated wallet payouts
                      </li>
                    </ul>
                  </div>
                  <Link
                    to="/signup"
                    className="block w-full bg-brand hover:bg-brand-dark text-white text-center font-bold py-3.5 rounded-xl text-xs transition shadow-md"
                  >
                    Activate Plan
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}