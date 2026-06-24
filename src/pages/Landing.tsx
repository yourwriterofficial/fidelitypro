import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Users,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  DollarSign,
  BarChart3,
  Briefcase,
  Building2,
  Globe,
  Award,
  Clock,
  Lock,
  Headphones,
  BookOpen,
  PieChart,
  LineChart,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ─── Mock Market Data ──────────────────────────────────────────────
interface MarketData {
  btc: { price: number; change: number };
  eth: { price: number; change: number };
  sp500: { price: number; change: number };
  dow: { price: number; change: number };
  nasdaq: { price: number; change: number };
  gold: { price: number; change: number };
}

const initialMarketData: MarketData = {
  btc: { price: 62500, change: -2.1 },
  eth: { price: 1665, change: -3.8 },
  sp500: { price: 7365, change: -1.44 },
  dow: { price: 51666, change: -0.09 },
  nasdaq: { price: 25587, change: -2.21 },
  gold: { price: 2342, change: 0.32 },
};

function MarketTicker() {
  const [data, setData] = useState<MarketData>(initialMarketData);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = () => {
    setIsRefreshing(true);
    // Simulate small price fluctuations
    setData((prev) => ({
      btc: {
        price: prev.btc.price + (Math.random() - 0.5) * 100,
        change: prev.btc.change + (Math.random() - 0.5) * 0.2,
      },
      eth: {
        price: prev.eth.price + (Math.random() - 0.5) * 5,
        change: prev.eth.change + (Math.random() - 0.5) * 0.2,
      },
      sp500: {
        price: prev.sp500.price + (Math.random() - 0.5) * 10,
        change: prev.sp500.change + (Math.random() - 0.5) * 0.1,
      },
      dow: {
        price: prev.dow.price + (Math.random() - 0.5) * 20,
        change: prev.dow.change + (Math.random() - 0.5) * 0.05,
      },
      nasdaq: {
        price: prev.nasdaq.price + (Math.random() - 0.5) * 30,
        change: prev.nasdaq.change + (Math.random() - 0.5) * 0.1,
      },
      gold: {
        price: prev.gold.price + (Math.random() - 0.5) * 2,
        change: prev.gold.change + (Math.random() - 0.5) * 0.05,
      },
    }));
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (num: number) => {
    if (num >= 10000) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number) => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  const tickers = [
    { key: 'btc' as const, label: 'BTC/USD', icon: <DollarSign size={14} /> },
    { key: 'eth' as const, label: 'ETH/USD', icon: <DollarSign size={14} /> },
    { key: 'sp500' as const, label: 'S&P 500', icon: <BarChart3 size={14} /> },
    { key: 'dow' as const, label: 'Dow Jones', icon: <BarChart3 size={14} /> },
    { key: 'nasdaq' as const, label: 'Nasdaq', icon: <BarChart3 size={14} /> },
    { key: 'gold' as const, label: 'Gold', icon: <DollarSign size={14} /> },
  ];

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/60 py-2.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide flex-1">
            {tickers.map(({ key, label, icon }) => {
              const item = data[key];
              const isPositive = item.change >= 0;
              return (
                <div key={key} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-gray-400 text-xs font-medium">{label}</span>
                  <span className="text-white font-semibold text-sm tabular-nums">
                    {formatPrice(item.price)}
                  </span>
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {formatChange(item.change)}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Update</span>
          </button>
        </div>
        <div className="text-right mt-0.5">
          <span className="text-gray-600 text-[10px]">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* ===== Navigation ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg tracking-tight">F</span>
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">FidelityPro</span>
              <span className="hidden lg:inline-block text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">
                Invest
              </span>
            </div>

            {/* Desktop nav links — scroll to sections */}
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
              <a href="#markets" className="hover:text-brand transition">Markets</a>
              <a href="#features" className="hover:text-brand transition">Features</a>
              <a href="#how-it-works" className="hover:text-brand transition">How It Works</a>
              <a href="#why-fidelity" className="hover:text-brand transition">Why FidelityPro</a>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:inline-block text-sm font-medium text-gray-700 hover:text-brand transition px-3 py-1.5"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition"
              >
                Open Account
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== Market Ticker ===== */}
      <div id="markets" className="pt-16">
        <MarketTicker />
      </div>

      {/* ===== Hero Section ===== */}
      <section className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/90 via-white to-gray-50/40 -z-10" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-[100px] -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left column: copy */}
            <div>
              <div className="inline-flex items-center gap-2.5 bg-white/90 backdrop-blur-sm border border-gray-200/80 px-4 py-1.5 rounded-full text-sm mb-6 shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-gray-700 font-medium text-sm">
                  Trusted by 12,847+ investors
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500 text-xs">A+ Rated</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-gray-900">
                Grow your wealth with{' '}
                <span className="bg-gradient-to-r from-brand to-emerald-500 text-transparent bg-clip-text">
                  intelligent investing
                </span>
              </h1>

              <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
                A modern investment platform built for long‑term growth, capital
                preservation, and transparent returns.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="px-8 py-3.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  Open Your Account <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-3.5 bg-white border border-gray-300 hover:border-brand text-gray-700 hover:text-brand font-medium rounded-xl text-base transition flex items-center justify-center gap-2"
                >
                  Log In
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-brand" />
                  <span>256‑bit SSL</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand" />
                  <span>FDIC Insured</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-brand" />
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>

            {/* Right column: portfolio snapshot */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100/80 p-6 lg:p-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <PieChart size={18} className="text-brand" />
                    <span>Portfolio Snapshot</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 px-2.5 py-0.5 rounded">
                    Estimated
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="text-gray-500 text-sm">Total Value</span>
                    <span className="text-2xl font-bold text-gray-900">$184,290</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Daily Return</span>
                      <p className="text-lg font-semibold text-emerald-600">+$342.80</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">YTD Return</span>
                      <p className="text-lg font-semibold text-emerald-600">+12.4%</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Risk Level</span>
                      <p className="text-lg font-semibold text-gray-800">Moderate</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Dividends</span>
                      <p className="text-lg font-semibold text-gray-800">$1,240</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    to="/signup"
                    className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-lg text-sm transition"
                  >
                    View Your Portfolio
                  </Link>
                </div>
              </div>

              {/* Floating social proof badge */}
              <div className="absolute -bottom-3 -right-3 bg-white rounded-xl shadow-lg border border-gray-100/80 px-4 py-2.5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand">JD</div>
                  <div className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-700">MK</div>
                  <div className="w-7 h-7 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-amber-700">TR</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">1,247 joined</p>
                  <p className="text-[10px] text-gray-400">this week</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust metrics */}
          <div className="mt-16 pt-8 border-t border-gray-200/60 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">12,847+</p>
              <p className="text-sm text-gray-500">Active Investors</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">$10M+</p>
              <p className="text-sm text-gray-500">Total Invested</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">98.7%</p>
              <p className="text-sm text-gray-500">Satisfaction Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">4.9★</p>
              <p className="text-sm text-gray-500">Average Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section id="features" className="py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Built for modern investors
            </h2>
            <p className="text-gray-600 mt-3 max-w-2xl mx-auto">
              Security, transparency, and performance — all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <TrendingUp size={24} />,
                title: 'Competitive Returns',
                desc: 'Earn daily returns with a diversified, low‑risk strategy designed for steady growth.',
              },
              {
                icon: <Shield size={24} />,
                title: 'Capital Protection',
                desc: 'Your principal is secured with audited strategies and institutional‑grade risk management.',
              },
              {
                icon: <Headphones size={24} />,
                title: 'Dedicated Support',
                desc: 'Reach our team 24/7 via live chat, email, or phone — we\'re here to help.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition"
              >
                <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center text-brand mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How It Works Section ===== */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Start in 3 simple steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: '1', title: 'Create Account', desc: 'Sign up in minutes with just your email and basic details.' },
              { step: '2', title: 'Fund Your Account', desc: 'Deposit via bank transfer, wire, or cryptocurrency (USDT).' },
              { step: '3', title: 'Start Earning', desc: 'Choose a plan and watch your returns grow daily.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center text-2xl font-bold text-brand mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Why FidelityPro ===== */}
      <section id="why-fidelity" className="py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Why Us</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              A better way to invest
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: <Award size={20} />, title: 'A+ Rated', desc: 'Independent third‑party rating for financial stability.' },
              { icon: <Globe size={20} />, title: 'Global Access', desc: 'Invest from anywhere in the world with multi‑currency support.' },
              { icon: <Lock size={20} />, title: 'Bank‑Grade Security', desc: '256‑bit encryption, cold storage, and regular audits.' },
              { icon: <BookOpen size={20} />, title: 'Educational Resources', desc: 'Learn investing with our library of guides and webinars.' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-16 bg-gradient-to-r from-brand to-emerald-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Ready to grow your wealth?
          </h2>
          <p className="text-green-50/90 text-lg mb-7">
            Join thousands of investors already earning daily returns.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-white text-brand hover:bg-gray-50 px-8 py-3.5 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition"
          >
            Get Started Today <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-gray-900 text-gray-400 pt-14 pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10">
            {/* Brand + contact */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg tracking-tight">F</span>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">FidelityPro</span>
              </div>
              <p className="text-sm text-gray-400 mb-3 leading-relaxed">
                A modern investment platform for long‑term growth and capital preservation.
              </p>
              {/* Mailto link – no visible email address */}
              <a
                href="mailto:teamonline4u@gmail.com"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
              >
                <Mail size={16} />
                <span>Contact Support</span>
              </a>
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Phone size={14} />
                <span>+1 (800) 555‑0199</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <MapPin size={14} />
                <span>Boston, MA</span>
              </div>
            </div>

            {/* Footer links – section anchors use #, others remain as router links */}
            <div>
              <h4 className="text-white font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#plans" className="hover:text-white transition">Plans</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
                <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition">Contact</Link></li>
                <li><Link to="/careers" className="hover:text-white transition">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="hover:text-white transition">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link to="/security" className="hover:text-white transition">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800/60 mt-10 pt-6 text-sm text-center text-gray-500">
            &copy; {new Date().getFullYear()} FidelityPro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}