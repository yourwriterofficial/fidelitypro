import { Sparkles } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Data Governance
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-gray-500 text-xs mt-2">Last updated: June 2026</p>
        </div>

        <div className="bg-white rounded-3xl shadow-md p-8 sm:p-12 border border-gray-100 space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Information Collection</h2>
            <p>
              We collect information necessary to securely operate your multi-asset portfolio, including email address, encrypted authentication hashes, deposit/withdrawal transaction hashes, and communication logs.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Usage of Data</h2>
            <p>
              Your data is exclusively used for transaction processing, escrow verification in P2P transactions, property deed record management, dividend distributions, and account security notices.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Zero Third-Party Sale Guarantee</h2>
            <p>
              RPM does not sell, rent, or trade your personal or financial data to third-party marketers or advertisers under any circumstances.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Cryptographic Security Standards</h2>
            <p>
              All stored records are safeguarded by 256-bit AES encryption at rest and TLS 1.3 in transit.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Inquiries</h2>
            <p>
              For privacy requests or account data inquiries, email our Data Governance Officer at{' '}
              <a href="mailto:teamonline4u@gmail.com" className="text-brand font-semibold hover:underline">
                teamonline4u@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}