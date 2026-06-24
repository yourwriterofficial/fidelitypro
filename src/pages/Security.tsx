export default function Security() {
  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">Security</h1>
        <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100 space-y-4">
          <p>Your security is our top priority. We implement industry-standard measures to protect your data.</p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>256-bit SSL encryption</li>
            <li>Two-factor authentication (coming soon)</li>
            <li>Regular security audits</li>
            <li>Secure data storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}