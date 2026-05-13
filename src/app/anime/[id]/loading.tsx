import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AnimeLoading() {
  return (
    <div>
      {/* Banner skeleton */}
      <div className="w-full h-[250px] md:h-[300px] skeleton" />
      <div className="px-4 md:px-6 max-w-7xl mx-auto -mt-24 relative z-10">
        <div className="flex gap-5 items-end">
          <div className="w-[140px] h-[200px] rounded-xl skeleton shrink-0" />
          <div className="flex-1 pb-2 space-y-3">
            <div className="h-4 w-16 skeleton rounded" />
            <div className="h-7 w-3/4 skeleton rounded" />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 skeleton rounded" />
              <div className="h-5 w-16 skeleton rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-32 skeleton rounded-lg" />
              <div className="h-10 w-10 skeleton rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
