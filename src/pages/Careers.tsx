import { Sparkles, ArrowRight } from 'lucide-react';

export default function Careers() {
  const openings = [
    { title: 'Real Estate Portfolio Underwriter', dept: 'Asset Management', location: 'Remote / Boston, MA', type: 'Full-Time' },
    { title: 'P2P Escrow & Risk Analyst', dept: 'Compliance & Safety', location: 'Remote', type: 'Full-Time' },
    { title: 'Senior Blockchain & Backend Engineer', dept: 'Engineering', location: 'Remote', type: 'Full-Time' },
    { title: 'VIP Client Relationship Manager', dept: 'Investor Relations', location: 'Remote / London, UK', type: 'Full-Time' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={13} /> Join The Team
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Careers at RPM
          </h1>
          <p className="text-gray-600 mt-4 text-base leading-relaxed">
            Help us build the next generation of fractional real estate, locked savings, and peer-to-peer decentralized financial infrastructure.
          </p>
        </div>

        {/* Open Positions */}
        <div className="space-y-4 mb-12">
          {openings.map((job, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <span className="text-[11px] font-bold text-brand uppercase tracking-wider block mb-1">
                  {job.dept}
                </span>
                <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                  <span>{job.location}</span>
                  <span>•</span>
                  <span>{job.type}</span>
                </div>
              </div>
              <a
                href="mailto:teamonline4u@gmail.com?subject=Job Application: "
                className="inline-flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-brand text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shrink-0"
              >
                Apply Now <ArrowRight size={13} />
              </a>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Don’t see a matching position?</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">We are always scouting exceptional talent across finance, engineering, and customer success.</p>
          <a
            href="mailto:teamonline4u@gmail.com"
            className="text-xs font-bold text-brand hover:underline"
          >
            Send your resume to teamonline4u@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}