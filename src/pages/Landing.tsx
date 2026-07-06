import { Link } from 'react-router-dom';
import {
  ArrowRight, TrendingUp, Shield, Mail, Phone, MapPin, RefreshCw,
  ArrowUp, ArrowDown, Globe, Award, Clock, Lock, Headphones, BookOpen,
  PieChart, Menu, X, ChevronDown, Star, CheckCircle,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketData {
  btc:    { price: number; change: number };
  eth:    { price: number; change: number };
  sp500:  { price: number; change: number };
  dow:    { price: number; change: number };
  nasdaq: { price: number; change: number };
  gold:   { price: number; change: number };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIntersection(ref: React.RefObject<Element>, rootMargin = '0px') {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return isVisible;
}

function useCountUp(target: number, isVisible: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration]);
  return count;
}

// ─── Market Ticker ───────────────────────────────────────────────────────────

const initialMarketData: MarketData = {
  btc:    { price: 62500,  change: -2.1  },
  eth:    { price: 1665,   change: -3.8  },
  sp500:  { price: 7365,   change: -1.44 },
  dow:    { price: 51666,  change: -0.09 },
  nasdaq: { price: 25587,  change: -2.21 },
  gold:   { price: 2342,   change:  0.32 },
};

const tickers = [
  { key: 'btc'    as const, label: 'BTC/USD'   },
  { key: 'eth'    as const, label: 'ETH/USD'   },
  { key: 'sp500'  as const, label: 'S&P 500'   },
  { key: 'dow'    as const, label: 'Dow Jones' },
  { key: 'nasdaq' as const, label: 'Nasdaq'    },
  { key: 'gold'   as const, label: 'Gold'      },
];

function MarketTicker() {
  const [data, setData] = useState<MarketData>(initialMarketData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    setData(prev => ({
      btc:    { price: prev.btc.price    + (Math.random() - 0.5) * 100, change: prev.btc.change    + (Math.random() - 0.5) * 0.2  },
      eth:    { price: prev.eth.price    + (Math.random() - 0.5) * 5,   change: prev.eth.change    + (Math.random() - 0.5) * 0.2  },
      sp500:  { price: prev.sp500.price  + (Math.random() - 0.5) * 10,  change: prev.sp500.change  + (Math.random() - 0.5) * 0.1  },
      dow:    { price: prev.dow.price    + (Math.random() - 0.5) * 20,  change: prev.dow.change    + (Math.random() - 0.5) * 0.05 },
      nasdaq: { price: prev.nasdaq.price + (Math.random() - 0.5) * 30,  change: prev.nasdaq.change + (Math.random() - 0.5) * 0.1  },
      gold:   { price: prev.gold.price   + (Math.random() - 0.5) * 2,   change: prev.gold.change   + (Math.random() - 0.5) * 0.05 },
    }));
    setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  useEffect(() => {
    const id = setInterval(refreshData, 30000);
    return () => clearInterval(id);
  }, [refreshData]);

  const fmt = (n: number) =>
    n >= 1000
      ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtChg = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`;

  // Duplicate for seamless marquee loop
  const items = [...tickers, ...tickers];

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/60 py-2 overflow-hidden">
      <div className="flex items-center">
        <div className="shrink-0 bg-brand text-white text-xs font-bold px-3 py-1 z-10 mr-2">LIVE</div>
        <div className="flex gap-8 animate-marquee whitespace-nowrap">
          {items.map(({ key, label }, i) => {
            const item = data[key];
            const pos  = item.change >= 0;
            return (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-gray-400 text-xs font-medium">{label}</span>
                <span className="text-white font-semibold text-sm tabular-nums">{fmt(item.price)}</span>
                <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pos ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {fmtChg(item.change)}
                </span>
                <span className="text-gray-700">•</span>
              </span>
            );
          })}
        </div>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className="shrink-0 ml-3 text-gray-500 hover:text-white transition disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}

// ─── Animated Stat ────────────────────────────────────────────────────────────

function AnimatedStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersection(ref as React.RefObject<Element>, '-50px');
  const count   = useCountUp(value, visible);
  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl font-bold text-gray-900 tabular-nums">{count.toLocaleString()}{suffix}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersection(ref as React.RefObject<Element>, '-60px');
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const faqs = [
  { q: 'How do I get started?',                  a: 'Create a free account, verify your identity, fund your wallet via bank transfer or USDT, then choose an investment plan. The whole process takes under 10 minutes.' },
  { q: 'How are returns calculated?',             a: "Returns are calculated daily based on your chosen plan's rate and compounded automatically. You can withdraw earnings at any time." },
  { q: 'Is my money safe?',                       a: 'Yes. We use 256-bit SSL encryption, cold storage for digital assets, and maintain a segregated client fund structure. Your principal is protected by institutional-grade risk management.' },
  { q: 'What currencies can I deposit in?',       a: 'We accept USD wire transfers, ACH, and USDT (TRC20/ERC20). More currencies are being added regularly.' },
  { q: 'How long do withdrawals take?',           a: 'Crypto withdrawals process within 24 hours. Bank withdrawals typically clear in 2–3 business days depending on your institution.' },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Common questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 60}>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex justify-between items-center px-6 py-4 text-left"
                >
                  <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: open === i ? '200px' : '0px' }}
                >
                  <p className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const plans = [
  {
    name: 'Starter',
    rate: '3%',
    period: 'daily',
    min: '$500',
    max: '$4,999',
    duration: '30 days',
    features: ['Daily ROI payouts', 'Basic portfolio dashboard', 'Email support'],
    highlight: false,
  },
  {
    name: 'Growth',
    rate: '5%',
    period: 'daily',
    min: '$5,000',
    max: '$49,999',
    duration: '60 days',
    features: ['Daily ROI payouts', 'Advanced analytics', 'Priority support', 'Referral bonuses'],
    highlight: true,
  },
  {
    name: 'Premium',
    rate: '8%',
    period: 'daily',
    min: '$50,000',
    max: 'Unlimited',
    duration: '90 days',
    features: ['Daily ROI payouts', 'Dedicated account manager', '24/7 phone support', 'Custom strategies', 'Referral bonuses'],
    highlight: false,
  },
];

const testimonials = [
  { name: 'James O.',    location: 'New York, USA',    text: 'RPM completely changed how I invest. My portfolio has grown 34% in six months. The dashboard is clean and withdrawals are always on time.',    stars: 5 },
  { name: 'Amara K.',   location: 'London, UK',        text: 'I was skeptical at first but the returns are real. Support team answered all my questions within minutes. Highly recommend the Growth plan.',            stars: 5 },
  { name: 'Carlos M.',  location: 'Toronto, Canada',   text: 'Transferred my retirement savings here and haven\'t looked back. Transparent fees, consistent daily payouts, and the referral program is generous.',  stars: 5 },
];

export default function Landing() {
  const [navScrolled, setNavScrolled]   = useState(false);
  const [mobileOpen,  setMobileOpen]    = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        navScrolled ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-gray-200/60' : 'bg-white border-b border-gray-200/70'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg tracking-tight">R</span>
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">RPM</span>
              <span className="hidden lg:inline-block text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">
                Invest
              </span>
            </div>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
              <a href="#markets"      className="hover:text-brand transition">Markets</a>
              <a href="#features"     className="hover:text-brand transition">Features</a>
              <a href="#plans"        className="hover:text-brand transition">Plans</a>
              <a href="#how-it-works" className="hover:text-brand transition">How It Works</a>
              <a href="#faq"          className="hover:text-brand transition">FAQ</a>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/login" className="hidden sm:inline-block text-sm font-medium text-gray-700 hover:text-brand transition px-3 py-1.5">
                Log In
              </Link>
              <Link to="/signup" className="bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition">
                Open Account
              </Link>
              {/* Hamburger */}
              <button
                className="md:hidden p-2 text-gray-600 hover:text-brand transition"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 bg-white border-t border-gray-100 ${mobileOpen ? 'max-h-72' : 'max-h-0'}`}>
          <div className="px-5 py-4 space-y-3 text-sm font-medium text-gray-700">
            {[['#markets','Markets'],['#features','Features'],['#plans','Plans'],['#how-it-works','How It Works'],['#faq','FAQ']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} className="block py-1 hover:text-brand transition">{label}</a>
            ))}
            <Link to="/login"  onClick={() => setMobileOpen(false)} className="block py-1 hover:text-brand transition">Log In</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)} className="block mt-2 bg-brand text-white text-center py-2.5 rounded-lg font-semibold">Open Account</Link>
          </div>
        </div>
      </nav>

      {/* ── Ticker ── */}
      <div id="markets" className="pt-16">
        <MarketTicker />
      </div>

      {/* ── Hero ── */}
      <section className="relative pt-14 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/90 via-white to-gray-50/40 -z-10" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-[100px] -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2.5 bg-white/90 backdrop-blur-sm border border-gray-200/80 px-4 py-1.5 rounded-full text-sm mb-6 shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-gray-700 font-medium text-sm">Trusted by 12,847+ investors</span>
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
                A modern investment platform built for long‑term growth, capital preservation, and transparent daily returns.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup" className="px-8 py-3.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
                  Open Your Account <ArrowRight size={18} />
                </Link>
                <a href="#plans" className="px-8 py-3.5 bg-white border border-gray-300 hover:border-brand text-gray-700 hover:text-brand font-medium rounded-xl text-base transition flex items-center justify-center gap-2">
                  View Plans
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2"><Lock    size={15} className="text-brand" /><span>256‑bit SSL</span></div>
                <div className="flex items-center gap-2"><Shield  size={15} className="text-brand" /><span>FDIC Insured</span></div>
                <div className="flex items-center gap-2"><Clock   size={15} className="text-brand" /><span>24/7 Support</span></div>
              </div>
            </div>

            {/* Right – Portfolio card */}
            <div className="relative" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100/80 p-6 lg:p-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <PieChart size={18} className="text-brand" />
                    <span>Portfolio Snapshot</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 px-2.5 py-0.5 rounded">Estimated</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <span className="text-gray-500 text-sm">Total Value</span>
                    <span className="text-2xl font-bold text-gray-900">$184,290</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Daily Return', val: '+$342.80', color: 'text-emerald-600' },
                      { label: 'YTD Return',   val: '+12.4%',   color: 'text-emerald-600' },
                      { label: 'Risk Level',   val: 'Moderate', color: 'text-gray-800'    },
                      { label: 'Dividends',    val: '$1,240',   color: 'text-gray-800'    },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
                        <p className={`text-lg font-semibold ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mini sparkline (decorative) */}
                <div className="mt-4 h-12 flex items-end gap-1">
                  {[40, 55, 48, 62, 58, 72, 67, 80, 74, 88, 82, 95].map((h, i) => (
                    <div key={i} className="flex-1 bg-brand/20 rounded-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  <Link to="/signup" className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-lg text-sm transition">
                    View Your Portfolio
                  </Link>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 bg-white rounded-xl shadow-lg border border-gray-100/80 px-4 py-2.5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[['JD','brand/10','brand'],['MK','emerald-100','emerald-700'],['TR','amber-100','amber-700']].map(([init, bg, txt]) => (
                    <div key={init} className={`w-7 h-7 rounded-full bg-${bg} border-2 border-white flex items-center justify-center text-[10px] font-bold text-${txt}`}>{init}</div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">1,247 joined</p>
                  <p className="text-[10px] text-gray-400">this week</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 pt-8 border-t border-gray-200/60 grid grid-cols-2 md:grid-cols-4 gap-6">
            <AnimatedStat value={12847}  suffix="+" label="Active Investors" />
            <AnimatedStat value={10}     suffix="M+" label="Total Invested ($)" />
            <AnimatedStat value={98}     suffix=".7%" label="Satisfaction Rate" />
            <AnimatedStat value={4}      suffix=".9★" label="Average Rating" />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Built for modern investors</h2>
            <p className="text-gray-600 mt-3 max-w-2xl mx-auto">Security, transparency, and performance — all in one platform.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <TrendingUp size={24} />, title: 'Competitive Returns',   desc: 'Earn daily returns with a diversified, low‑risk strategy designed for steady, compounding growth.'  },
              { icon: <Shield     size={24} />, title: 'Capital Protection',    desc: 'Your principal is secured with audited strategies and institutional‑grade risk management.'          },
              { icon: <Headphones size={24} />, title: 'Dedicated Support',     desc: 'Reach our team 24/7 via live chat, email, or phone — real humans, fast responses.'                   },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-full">
                  <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center text-brand mb-4">{f.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="plans" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Investment Plans</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Choose your growth path</h2>
            <p className="text-gray-600 mt-3 max-w-2xl mx-auto">All plans include daily payouts and 100% principal protection.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div className={`relative flex flex-col rounded-2xl border p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  plan.highlight
                    ? 'bg-gray-900 border-gray-700 text-white shadow-2xl scale-105'
                    : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className={`text-5xl font-extrabold tracking-tight ${plan.highlight ? 'text-emerald-400' : 'text-brand'}`}>{plan.rate}</span>
                      <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
                    </div>
                    <p className={`text-sm mt-2 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                      {plan.min} – {plan.max} · {plan.duration}
                    </p>
                  </div>
                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map(feat => (
                      <li key={feat} className="flex items-center gap-2 text-sm">
                        <CheckCircle size={16} className={plan.highlight ? 'text-emerald-400' : 'text-brand'} />
                        <span className={plan.highlight ? 'text-gray-300' : 'text-gray-600'}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/signup"
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                      plan.highlight
                        ? 'bg-brand text-white hover:bg-brand-dark shadow-lg'
                        : 'bg-gray-100 text-gray-900 hover:bg-brand hover:text-white'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Start in 3 simple steps</h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-10 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
            {[
              { step: '1', title: 'Create Account', desc: 'Sign up in minutes with just your email and basic details.' },
              { step: '2', title: 'Fund Your Account', desc: 'Deposit via bank transfer, wire, or cryptocurrency (USDT).' },
              { step: '3', title: 'Start Earning', desc: 'Choose a plan and watch your returns grow daily.' },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 120} className="text-center">
                <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-brand/30">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm max-w-xs mx-auto">{item.desc}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why RPM ── */}
      <section id="why-rpm" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Why Us</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">A better way to invest</h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: <Award    size={20} />, title: 'A+ Rated',                  desc: 'Independent third‑party rating for financial stability and trustworthiness.' },
              { icon: <Globe    size={20} />, title: 'Global Access',              desc: 'Invest from anywhere in the world with multi‑currency support.'             },
              { icon: <Lock     size={20} />, title: 'Bank‑Grade Security',        desc: '256‑bit encryption, cold storage, and regular security audits.'             },
              { icon: <BookOpen size={20} />, title: 'Educational Resources',      desc: 'Learn investing with our growing library of guides and live webinars.'       },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="flex items-start gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand shrink-0">{item.icon}</div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <span className="text-brand font-semibold tracking-[0.2em] text-sm uppercase">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">What our investors say</h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="bg-white p-7 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <Star key={s} size={15} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed flex-1">"{t.text}"</p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-gray-400 text-xs">{t.location}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQ />

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-900 to-brand/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/10 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Ready to grow<br />your wealth?
            </h2>
            <p className="text-gray-300 text-lg mb-8">Join thousands of investors already earning daily returns.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-8 py-4 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition">
                Open Account Free <ArrowRight size={18} />
              </Link>
              <a href="#plans" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl font-medium text-base transition">
                View Plans
              </a>
            </div>
            <p className="mt-6 text-gray-500 text-sm">No hidden fees. Cancel anytime.</p>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-gray-400 pt-14 pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg tracking-tight">R</span>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">RPM</span>
              </div>
              <p className="text-sm text-gray-400 mb-3 leading-relaxed">A modern investment platform for long‑term growth and capital preservation.</p>
              <a href="mailto:support@remaprofitmachine.com" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                <Mail size={14} /><span>support@remaprofitmachine.com</span>
              </a>
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Phone size={13} /><span>+1 (800) 555‑0199</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <MapPin size={13} /><span>Boston, MA</span>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#plans"        className="hover:text-white transition">Plans</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
                <li><a href="#faq"          className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about"   className="hover:text-white transition">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition">Contact</Link></li>
                <li><Link to="/careers" className="hover:text-white transition">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms"    className="hover:text-white transition">Terms of Service</Link></li>
                <li><Link to="/privacy"  className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link to="/security" className="hover:text-white transition">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800/60 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
            <span>&copy; {new Date().getFullYear()} RPM (Rema Profit Machine). All rights reserved.</span>
            <div className="flex items-center gap-2 text-gray-600">
              <Lock size={11} />
              <span>256-bit SSL Secured</span>
              <span className="mx-2">·</span>
              <Shield size={11} />
              <span>FDIC Insured</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Marquee + float keyframes injected inline */}
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
          display: inline-flex;
          gap: 2rem;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
