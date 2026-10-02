import Link from "next/link";
import Header from "@/components/layout/Header";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function AuthError({ searchParams }) {
  const { next } = await searchParams;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-4 font-display text-4xl">Sign-in wasn’t completed</h1>
        <p className="mb-6 text-muted">You can return to your page and try signing in with Google again.</p>
        <Link href={safeReturnPath(next)} className="inline-block rounded-[3px] bg-ink px-5 py-3 text-background">Return to your page</Link>
      </main>
    </>
  );
}
