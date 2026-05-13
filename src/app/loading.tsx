export default function HomeLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <div className="w-full h-[70vh] min-h-[400px] max-h-[700px] skeleton" />

      {/* Trending skeleton */}
      <div className="px-4 md:px-6 py-6">
        <div className="h-6 w-40 skeleton rounded mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-[150px] shrink-0">
              <div className="aspect-[3/4] rounded-lg skeleton mb-2" />
              <div className="h-3 w-3/4 skeleton rounded mb-1" />
              <div className="h-3.5 w-full skeleton rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="px-4 md:px-6 py-6">
        <div className="h-10 w-full skeleton rounded mb-6" />
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] rounded-lg skeleton mb-2" />
              <div className="h-3 w-3/4 skeleton rounded mb-1" />
              <div className="h-3.5 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
