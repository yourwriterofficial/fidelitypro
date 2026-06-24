export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">How It Works</h1>
        <p className="text-center text-gray-600 mb-12">Getting started with FidelityPro is simple. Follow these three steps.</p>
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex items-start gap-4">
              <span className="bg-green-100 text-green-700 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Create Account</h3>
                <p className="text-gray-600 mt-1">Sign up for free in minutes. Provide your email and set a password.</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex items-start gap-4">
              <span className="bg-green-100 text-green-700 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Make a Deposit</h3>
                <p className="text-gray-600 mt-1">Fund your account via bank transfer or crypto (USDT). Minimum deposit starts from $10.</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex items-start gap-4">
              <span className="bg-green-100 text-green-700 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Start Earning</h3>
                <p className="text-gray-600 mt-1">Choose an investment plan and watch your daily returns grow automatically.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-12">
          <Link to="/signup" className="bg-brand hover:bg-brand-dark text-white px-8 py-3 rounded-xl font-semibold transition">
            Start Investing Now
          </Link>
        </div>
      </div>
    </div>
  );
}