import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Logo className="size-10" />
      <h1 className="mt-6 text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-[15px] text-zinc-600">This page doesn&apos;t exist, or it belongs to another flat.</p>
      <Link href="/" className="mt-6 rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800">
        Go home
      </Link>
    </main>
  );
}
