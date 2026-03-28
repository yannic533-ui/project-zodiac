import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-zinc-400 mb-4">Der Bote</p>
      <Link
        href="/admin"
        className="text-amber-500/90 hover:text-amber-400 underline underline-offset-4"
      >
        Admin
      </Link>
    </main>
  );
}
