import { Lock, CheckCircle2, Server, Eye, FileCheck2, Sparkles } from 'lucide-react';

export default function Security() {
  const securityFeatures = [
    {
      icon: <Lock size={20} />,
      title: '256-Bit Financial Encryption',
      desc: 'All communication, account data, and session transactions are encrypted end-to-end using TLS 1.3 and military-grade 256-bit AES algorithms.'
    },
    {
      icon: <Server size={20} />,
      title: 'Cold Storage Vaults',
      desc: '98% of all digital and cryptocurrency reserves are stored in offline, air-gapped multi-signature cold vaults with geographically distributed key shards.'
    },
    {
      icon: <FileCheck2 size={20} />,
      title: 'Verified Title Deeds & Escrow',
      desc: 'Every real estate listing is legally notarized and audited by independent legal firms. All P2P trades are governed by automated cryptographic escrow contracts.'
    },
    {
      icon: <Eye size={20} />,
      title: 'Real-Time Fraud & Anomaly Monitoring',
      desc: 'Automated AI monitoring analyzes 100% of network withdrawals and transaction vectors to prevent unauthorized account access.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Institutional Standards
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Security & Capital Protection
          </h1>
          <p className="text-gray-600 mt-4 text-base leading-relaxed">
            Your trust is our paramount asset. We implement stringent multi-tier security standards across Properties, Staking, P2P, and Investment services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {securityFeatures.map((f, i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-7 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Segregated Capital Reserves</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Client deposits, real estate deed reserves, and staking allocations are held in segregated, audited custodial accounts. RPM never commingles operational company capital with investor principal.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 text-xs text-gray-300">
            <div className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-brand-light" /> SOC-2 Audited</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-brand-light" /> 2FA Ready</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-brand-light" /> Escrow Backed</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-brand-light" /> 100% Principal Safe</div>
          </div>
        </div>
      </div>
    </div>
  );
}