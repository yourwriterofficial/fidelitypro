export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">Privacy Policy</h1>
        <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100 prose prose-sm max-w-none">
          <p><strong>Last updated:</strong> June 2026</p>
          <h2>1. Information We Collect</h2>
          <p>We collect personal information such as name, email, and payment details.</p>
          <h2>2. How We Use Information</h2>
          <p>We use your information to provide and improve our services.</p>
          <h2>3. Data Security</h2>
          <p>We take security seriously and use encryption and secure servers.</p>
          <h2>4. Sharing of Data</h2>
          <p>We do not sell your personal data to third parties.</p>
          <h2>5. Contact</h2>
          <p>If you have questions, contact us at <a href="mailto:teamonline4u@gmail.com" className="text-brand hover:underline">teamonline4u@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  );
}