export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-6 animate-fade-in">
      <div className="relative w-12 h-12">
        <div className="w-12 h-12 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-brand rounded-full animate-pulse" />
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gray-400">Loading RPM</p>
    </div>
  );
}
