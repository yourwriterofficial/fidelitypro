import { Mail, Phone, MapPin, Clock, Sparkles } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> 24/7 Global Desk
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Contact Us
          </h1>
          <p className="text-gray-600 mt-4 text-base leading-relaxed">
            Have questions about Real Estate fractional shares, Locked Savings, P2P dispute assistance, or Investment accounts? We are here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
              <Mail size={22} />
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-1">Email Desk</h3>
            <p className="text-xs text-gray-500 mb-3">General inquiries & support</p>
            <a href="mailto:teamonline4u@gmail.com" className="text-xs font-bold text-brand hover:underline">
              teamonline4u@gmail.com
            </a>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
              <Phone size={22} />
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-1">VIP Phone Line</h3>
            <p className="text-xs text-gray-500 mb-3">Institutional & property advisory</p>
            <span className="text-xs font-bold text-gray-800">+1 (800) 555-0199</span>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
              <MapPin size={22} />
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-1">Headquarters</h3>
            <p className="text-xs text-gray-500 mb-3">Global Asset Center</p>
            <span className="text-xs font-bold text-gray-800">Boston, MA, USA</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-8 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand mb-2">
            <Clock size={14} /> Response Time
          </div>
          <h3 className="text-lg font-bold text-gray-900">Average Response Time &lt; 2 Hours</h3>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Our specialized multi-asset support desk operates 24/7/365 to provide instantaneous resolution for all account, escrow, and property verification queries.
          </p>
        </div>
      </div>
    </div>
  );
}