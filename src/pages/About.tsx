import { Link } from 'react-router-dom';
import { Home, Layers, ArrowLeftRight, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Our Mission & Heritage
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            About RPM
          </h1>
          <p className="text-gray-600 mt-4 text-base sm:text-lg leading-relaxed">
            Pioneering a unified multi-asset financial ecosystem — bridging fractional Real Estate Properties, high-yield Locked Savings, P2P Escrow Exchange, and Managed Yield Plans.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-12 mb-12 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Democratizing Global Wealth Creation</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              RPM was founded with a singular objective: to eliminate traditional barriers in wealth generation. By combining institutional-grade asset underwriting, smart escrow protocols, and transparent daily distributions, we enable over 12,000+ investors to access top-tier wealth vehicles from anywhere in the world.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-100/80">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3">
                <Home size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Real Estate Properties</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Fractional title ownership in verified residential and commercial assets with automated rental yield payouts directly to your wallet.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3">
                <Layers size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Locked Savings (Staking)</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Fixed-term high-yield lock programs (7–365 days) offering up to 18% APY backed by 100% principal protection guarantees.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-teal-50/60 border border-teal-100/80">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-3">
                <ArrowLeftRight size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">P2P Escrow Exchange</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Direct peer-to-peer liquidity matching at 0% platform commission with automated institutional escrow protection.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100/80">
              <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center mb-3">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Managed Yield Portfolios</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Algorithmic trading and capital management delivering consistent daily ROI distributions with zero hidden fees.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-extrabold text-brand">12,800+</p>
              <p className="text-xs text-gray-500 mt-1">Active Global Members</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-brand">$10M+</p>
              <p className="text-xs text-gray-500 mt-1">Assets Managed</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-brand">98.7%</p>
              <p className="text-xs text-gray-500 mt-1">Client Satisfaction</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-brand">100%</p>
              <p className="text-xs text-gray-500 mt-1">Principal Security</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold px-8 py-4 rounded-2xl text-sm shadow-lg hover:shadow-xl transition"
          >
            Join RPM Today <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}