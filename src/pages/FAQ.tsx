import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      category: 'Real Estate Properties',
      q: 'How does fractional Real Estate investment work on RPM?',
      a: 'We acquire and title-verify prime residential and commercial real estate properties. Investors can purchase fractional shares starting from $500. Rental income paid by tenants is distributed proportionally to your wallet on a regular schedule, and your shares can be sold or liquidated on our platform.'
    },
    {
      category: 'Locked Savings (Staking)',
      q: 'What is Locked Savings (Staking) and what are the yields?',
      a: 'Locked Savings allows you to commit funds for fixed durations (7, 30, 90, 180, or 365 days) and earn up to 18% APY. Your returns accrue daily, and 100% of your initial capital is guaranteed and automatically unlocked when the lock period completes.'
    },
    {
      category: 'P2P Escrow Exchange',
      q: 'How does the P2P Marketplace protect buyers and sellers?',
      a: 'When an order is created, the seller’s crypto assets are immediately transferred into RPM’s automated escrow vault. The buyer pays directly via their chosen payment method. Once the seller confirms payment receipt, the escrow releases the assets to the buyer. If any discrepancy occurs, our 24/7 arbitration team steps in.'
    },
    {
      category: 'P2P Escrow Exchange',
      q: 'Are there any fees for trading on the P2P marketplace?',
      a: 'RPM charges 0% platform trading commission for all peer-to-peer cryptocurrency exchanges.'
    },
    {
      category: 'Investment Plans',
      q: 'How are ROI returns calculated on Investment Plans?',
      a: 'Investment Plans generate fixed daily percentages (between 3.0% and 8.0% daily) over 30 to 90 days. Daily profits can be withdrawn to your external crypto wallet/bank or compounded automatically.'
    },
    {
      category: 'Account & Security',
      q: 'What deposit methods are accepted?',
      a: 'You can fund your account via USDT (TRC20 / ERC20), direct cryptocurrency transfers, ACH, and standard bank wire. Deposits reflect within minutes once confirmed on the blockchain or banking network.'
    },
    {
      category: 'Account & Security',
      q: 'How long do withdrawals take?',
      a: 'Crypto withdrawals are processed within 24 hours. Bank withdrawals typically clear within 2–3 business days depending on your financial institution.'
    },
    {
      category: 'Account & Security',
      q: 'Is my money secure with RPM?',
      a: 'Yes. We employ 256-bit SSL encryption, cold storage for 98% of digital assets, multi-signature transaction approval, and segregated client reserve funds.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-600 mt-4 text-base leading-relaxed">
            Everything you need to know about Real Estate Properties, Staking, P2P Trading, and Investment Plans.
          </p>
        </div>

        {/* FAQs list */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full text-left p-6 flex items-start justify-between gap-4 hover:bg-gray-50/60 transition-colors"
                >
                  <div>
                    <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
                      {faq.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                      {faq.q}
                    </h3>
                  </div>
                  <div className={`p-2 rounded-xl bg-gray-100 text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-brand/10 text-brand' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 text-lg">Still have questions?</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">Our specialized asset management support team is ready 24/7 to assist you.</p>
          <a
            href="mailto:teamonline4u@gmail.com"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-sm"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}