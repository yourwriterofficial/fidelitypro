import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Shield, Users, Zap, Clock, CheckCircle, Star, DollarSign, BarChart3 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-black text-lg">F</span>
              </div>
              <span className="text-xl font-bold text-gray-900">FidelityPro</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-brand transition">Features</a>
              <a href="#how-it-works" className="hover:text-brand transition">How It Works</a>
              <a href="#testimonials" className="hover:text-brand transition">Testimonials</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hidden sm:inline-block text-sm font-medium text-gray-700 hover:text-brand transition">
                Log In
              </Link>
              <Link
                to="/signup"
                className="bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 via-white to-green-50/40 -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-green-200/30 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-[100px] -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200 px-4 py-1.5 rounded-full text-sm mb-6 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-700 font-medium">Trusted by 12,847+ active investors</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Grow your wealth with{' '}
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 text-transparent bg-clip-text">
              smart investing
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed">
            High-yield investment plans with daily returns. Start with as little as $10 and watch your portfolio grow.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-brand hover:bg-brand-dark text-white font-bold rounded-2xl text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
            >
              Open Account <ArrowRight size={20} />
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-white border-2 border-gray-200 hover:border-brand text-gray-700 hover:text-brand font-semibold rounded-2xl text-lg transition flex items-center justify-center gap-2"
            >
              Log In
            </Link>
          </div>

          {/* Trust Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            <div>
              <p className="text-3xl font-bold text-gray-900">12,847+</p>
              <p className="text-sm text-gray-500">Active Investors</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">$10M+</p>
              <p className="text-sm text-gray-500">Total Invested</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">98.7%</p>
              <p className="text-sm text-gray-500">Satisfaction Rate</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">24/7</p>
              <p className="text-sm text-gray-500">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-green-600 font-semibold tracking-widest text-sm uppercase">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Why choose FidelityPro?</h2>
            <p className="text-gray-600 mt-3 max-w-2xl mx-auto">We combine security, transparency, and high returns to help you achieve your financial goals.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">High Yields</h3>
              <p className="text-gray-600 text-sm">Earn daily returns with competitive rates. Our algorithm optimizes for maximum growth.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Capital Protection</h3>
              <p className="text-gray-600 text-sm">Your capital is secured with low-risk, audited investment strategies.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">24/7 Support</h3>
              <p className="text-gray-600 text-sm">Our dedicated team is here to help you every step of the way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-green-600 font-semibold tracking-widest text-sm uppercase">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">Get started in 3 simple steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-green-600 mx-auto mb-4">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Create Account</h3>
              <p className="text-gray-600 text-sm">Sign up for free and complete your profile in minutes.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-green-600 mx-auto mb-4">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Make a Deposit</h3>
              <p className="text-gray-600 text-sm">Fund your account via bank transfer or crypto (USDT).</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-green-600 mx-auto mb-4">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Start Earning</h3>
              <p className="text-gray-600 text-sm">Choose an investment plan and watch your daily returns grow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-emerald-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to grow your wealth?</h2>
          <p className="text-green-50 text-lg mb-8">Join thousands of investors already earning daily returns.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition"
          >
            Get Started Today <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-white font-black text-lg">F</span>
                </div>
                <span className="text-xl font-bold text-white">FidelityPro</span>
              </div>
              <p className="text-sm">Secure, high-yield investment portfolios.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Plans</a></li>
                <li><a href="#" className="hover:text-white transition">How It Works</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-10 pt-6 text-sm text-center">
            &copy; {new Date().getFullYear()} FidelityPro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}