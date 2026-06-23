import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { Clock } from 'lucide-react';

export default function InactivityBanner() {
  const { timeLeft, hasInvestment } = useInactivityTimer();

  if (hasInvestment || timeLeft === null || timeLeft <= 0) return null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-3 text-yellow-800">
      <Clock size={20} />
      <span className="text-sm">
        ⚠️ Invest within <strong>{formatTime(timeLeft)}</strong> or your account will be deactivated.
        This platform is for active investors only.
      </span>
    </div>
  );
}