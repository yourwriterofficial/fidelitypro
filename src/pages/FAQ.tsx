export default function FAQ() {
  const faqs = [
    { q: 'What is FidelityPro?', a: 'FidelityPro is a secure investment platform offering daily returns on your investments with capital protection.' },
    { q: 'How do I start investing?', a: 'Sign up, make a deposit, and choose an investment plan. Your returns will be credited daily.' },
    { q: 'Is my money safe?', a: 'Yes, we use low-risk, audited investment strategies and keep your funds secure.' },
    { q: 'What are the minimum and maximum investments?', a: 'Minimum is $10, and maximum depends on the plan you choose.' },
    { q: 'How do I withdraw my earnings?', a: 'Withdrawals are processed quickly. You can request a withdrawal from your wallet.' },
    { q: 'Is there a fee?', a: 'We charge zero fees on deposits and withdrawals.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">Frequently Asked Questions</h1>
        <p className="text-center text-gray-600 mb-12">Find answers to common questions about FidelityPro.</p>
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900">{faq.q}</h3>
              <p className="text-gray-600 mt-2">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}