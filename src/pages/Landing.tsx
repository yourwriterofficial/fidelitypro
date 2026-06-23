import { Link } from 'react-router-dom';
import { ArrowRight, Check, TrendingUp, Shield, Users } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 py-4 px-6 flex justify-between items-center">
        <span className="text-2xl font-bold text-brand">FidelityPro</span>
        <div className="flex gap-4">
          <Link to="/login" className="text-gray-600 hover:text-brand transition">Login</Link>
          <Link to="/signup" className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition shadow-md">Get Started</Link>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">
          Invest smart from the start
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          High-yield investment plans with daily returns. Start with as little as $10.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/signup" className="bg-brand hover:bg-brand-dark text-white px-8 py-3 rounded-lg text-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition">
            Open Account <ArrowRight size={20} />
          </Link>
          <Link to="/login" className="border-2 border-brand/40 hover:border-brand text-brand hover:bg-brand/5 px-8 py-3 rounded-lg text-lg transition">
            Login
          </Link>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <TrendingUp className="text-brand mb-3" size={28} />
            <h3 className="font-semibold text-lg">Daily Accruals</h3>
            <p className="text-sm text-gray-500">Earn daily returns credited automatically.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Shield className="text-brand mb-3" size={28} />
            <h3 className="font-semibold text-lg">Capital Protection</h3>
            <p className="text-sm text-gray-500">Your capital is secured with low-risk strategies.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Users className="text-brand mb-3" size={28} />
            <h3 className="font-semibold text-lg">Fast Withdrawals</h3>
            <p className="text-sm text-gray-500">Withdraw your earnings anytime with zero fees.</p>
          </div>
        </div>
      </div>
    </div>
  );
}