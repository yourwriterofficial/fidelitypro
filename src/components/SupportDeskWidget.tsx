import { Link, useLocation } from 'react-router-dom';
import { Headphones, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function SupportDeskWidget() {
  const location = useLocation();
  const { user } = useAuthStore();

  // Hide on dedicated chat pages, banned page, and admin chat
  if (
    location.pathname.startsWith('/app/chat') ||
    location.pathname.startsWith('/admin/chat') ||
    location.pathname.startsWith('/banned')
  ) {
    return null;
  }

  const targetLink = user ? '/app/chat?tab=support' : '/login?redirect=/app/chat?tab=support';

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 print:hidden">
      <Link
        to={targetLink}
        className="group flex items-center gap-2.5 px-4 py-3 bg-brand hover:bg-brand-dark text-white rounded-full shadow-lg shadow-brand/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-brand/35 border border-white/20"
        title="24/7 Official Support Helpdesk"
        aria-label="24/7 Official Support Helpdesk"
      >
        <div className="relative flex items-center justify-center">
          <Headphones size={20} className="text-white group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
          </span>
        </div>
        <div className="flex flex-col items-start pr-1">
          <span className="text-xs font-bold tracking-tight text-white leading-tight flex items-center gap-1">
            Support Desk <Sparkles size={10} className="text-emerald-300" />
          </span>
          <span className="text-[10px] text-emerald-100/90 font-medium leading-tight">
            24/7 Live Assistance
          </span>
        </div>
      </Link>
    </div>
  );
}

