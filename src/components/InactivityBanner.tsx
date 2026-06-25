import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { Clock, AlertTriangle } from 'lucide-react';

export default function InactivityBanner() {
  const { timeLeft, hasInvestment } = useInactivityTimer();

  if (hasInvestment || timeLeft === null || timeLeft <= 0) return null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Urgency threshold: turn red under 1 hour
  const isUrgent = timeLeft < 3600;

  return (
    <div className={`mb-5 rounded-2xl border flex items-start gap-3 px-4 py-3.5 ${
      isUrgent
        ? 'bg-red-50 border-red-200'
        : 'bg-amber-50 border-amber-200'
    }`}>
      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
        {isUrgent
          ? <AlertTriangle size={15} className="text-red-600" />
          : <Clock size={15} className="text-amber-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isUrgent ? 'text-red-800' : 'text-amber-800'}`}>
          Account Deactivation Warning
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
          Make an investment within{' '}
          <span className={`font-bold font-mono tracking-tight ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
            {formatTime(timeLeft)}
          </span>
          {' '}or your account will be deactivated. This platform is for active investors only.
        </p>
      </div>
    </div>
  );
}
