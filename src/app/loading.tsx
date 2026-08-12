export default function Loading() {
  return (
    <main className="sbr-fire-skin min-h-screen bg-[#070b0e] text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-3 py-3 sm:px-5 sm:py-5">
        <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-[#b70f18]/80 shadow-lg" />
        <div className="grid gap-3">
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-[#0d1317] shadow-xl" />
          <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-[#11171b] shadow-lg" />
          <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-[#11171b] shadow-lg" />
        </div>
      </div>
    </main>
  );
}
