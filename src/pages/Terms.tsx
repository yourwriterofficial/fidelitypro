import { Sparkles } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Legal Documentation
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-gray-500 text-xs mt-2">Last updated: June 2026</p>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-8 sm:p-12 border border-gray-100 space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or utilizing RPM (Rema Profit Machine) services, including Real Estate Fractional Properties, Locked Savings (Staking), P2P Escrow Exchange, and Managed Investment Plans, you agree to be bound by these Terms of Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Multi-Product Risk Disclosures</h2>
            <p>
              All digital asset investments, staking terms, and real estate fractional deed participations carry market risk. While principal protection and rental yield estimates are backed by reserves and audited protocols, past performance does not guarantee future results.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. P2P Escrow Guidelines & Compliance</h2>
            <p>
              Users participating in the P2P Escrow Marketplace must maintain verified account credentials. Escrow locks are automated, and false dispute claims or fraudulent payment submissions may result in immediate account termination.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. User Security Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials, wallet keys, and two-factor authentication tokens.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with international digital asset and asset management regulatory standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}