export default function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="aspect-[3/4] rounded-lg skeleton" />
      <div className="flex justify-between">
        <div className="h-3 w-16 rounded skeleton" />
        <div className="h-3 w-10 rounded skeleton" />
      </div>
      <div className="h-3.5 w-full rounded skeleton" />
    </div>
  );
}
