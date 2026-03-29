import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-950 text-zinc-100">
      <div className="max-w-lg text-center space-y-6">
        <p className="text-amber-500/90 tracking-tight text-sm uppercase">
          Schnuffis
        </p>
        <h1 className="text-3xl sm:text-4xl font-medium text-zinc-50 leading-tight">
          Scavenger hunts for bars, powered by Telegram
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          Onboard your venue with Google Places, let Claude draft riddles, then run
          live events for groups in your city. Players chat with Der Bote on Telegram
          while they move between stops.
        </p>
        <div className="flex flex-wrap gap-4 justify-center pt-2">
          <Link
            href="/login"
            className="rounded-lg bg-amber-600/90 hover:bg-amber-500 text-zinc-950 px-6 py-2.5 text-sm font-medium"
          >
            Sign up / Sign in
          </Link>
          <Link
            href="/login?next=/admin"
            className="rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 px-6 py-2.5 text-sm"
          >
            Super admin
          </Link>
        </div>
      </div>
    </main>
  );
}
