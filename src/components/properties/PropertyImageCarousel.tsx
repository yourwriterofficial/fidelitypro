import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PropertyImageCarouselProps {
  urls: string[];
  title: string;
  speed: number;
  className?: string;
  showArrows?: boolean;
}

export function PropertyImageCarousel({
  urls,
  title,
  speed,
  className = '',
  showArrows = true,
}: PropertyImageCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!urls || urls.length <= 1 || speed <= 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % urls.length);
    }, speed * 1000);
    return () => clearInterval(interval);
  }, [urls, speed]);

  if (!urls || urls.length === 0) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev - 1 + urls.length) % urls.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % urls.length);
  };

  return (
    <div className={`relative h-full w-full overflow-hidden group/carousel ${className}`}>
      {urls.map((url, i) => {
        const isActiveOrAdjacent =
          i === index ||
          i === (index - 1 + urls.length) % urls.length ||
          i === (index + 1) % urls.length;

        return (
          <div
            key={i}
            className="absolute inset-0 w-full h-full transition-transform duration-700 ease-in-out"
            style={{
              transform: `translateX(${(i - index) * 100}%)`,
            }}
          >
            {isActiveOrAdjacent && (
              <img
                src={url}
                alt={`${title} ${i + 1}`}
                className="w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            )}
          </div>
        );
      })}

      {/* Subtle Bottom Vignette */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none" />

      {/* Manual Navigation Controls (shown on hover if >1 image) */}
      {urls.length > 1 && showArrows && (
        <>
          <button
            onClick={handlePrev}
            type="button"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-200 z-10 hover:scale-105 shadow-sm"
            aria-label="Previous photo"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-200 z-10 hover:scale-105 shadow-sm"
            aria-label="Next photo"
          >
            <ChevronRight size={16} />
          </button>

          {/* Photo Counter Pill */}
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-900/70 backdrop-blur-md text-[10px] font-semibold text-white/90 z-10 tracking-wider">
            {index + 1} / {urls.length}
          </div>
        </>
      )}
    </div>
  );
}
