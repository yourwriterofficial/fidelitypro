import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function Plans() {
  const plans = [
    { name: 'Starter', min: 10, max: 100, dailyReturn: 2.5, duration: 30 },
    { name: 'Standard', min: 101, max: 500, dailyReturn: 3.0, duration: 45 },
    { name: 'Premium', min: 501, max: 5000, dailyReturn: 4.5, duration: 60 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-4">Investment Plans</h1>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Choose a plan that fits your goals. Each plan offers daily returns with capital protection.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.name} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{plan.name}</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} /> Min: ${plan.min}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} /> Max: ${plan.max}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} /> Daily Return: {plan.dailyReturn}%
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} /> Duration: {plan.duration} days
                </li>
              </ul>
              <div className="mt-6">
                <Link to="/signup" className="block w-full bg-brand hover:bg-brand-dark text-white text-center font-semibold py-3 rounded-xl transition">
                  Get Started
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}