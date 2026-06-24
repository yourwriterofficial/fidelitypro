export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">Contact Us</h1>
        <p className="text-center text-gray-600 mb-12">We’d love to hear from you. Reach out to us via email.</p>
        <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100 text-center">
          <p className="text-lg text-gray-700">Email: <a href="mailto:teamonline4u@gmail.com" className="text-brand hover:underline">teamonline4u@gmail.com</a></p>
          <p className="text-sm text-gray-500 mt-4">We respond within 24 hours.</p>
        </div>
      </div>
    </div>
  );
}