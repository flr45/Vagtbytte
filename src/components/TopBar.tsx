import { logoutAction } from "@/lib/actions";

export function TopBar({ title }: { title: string }) {
  return (
    <header className="border-b border-brand-line bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <p className="text-lg font-bold">{title}</p>
        <form action={logoutAction}>
          <button className="focus-ring min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-900">
            Log ud
          </button>
        </form>
      </div>
    </header>
  );
}
