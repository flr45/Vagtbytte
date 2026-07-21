export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6">
      <div className="h-16 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
      <div className="grid gap-3">
        <div className="h-32 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/70 shadow-sm" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/70 shadow-sm" />
      </div>
    </main>
  );
}
